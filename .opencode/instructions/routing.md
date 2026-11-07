# Task Routing Rules

## Roles

| Role | Agent | Mode | Model | Scope & Permissions |
|---|---|---|---|---|
| **Primary Orchestrator** | `build` | `primary` | `cpa-gui/gemini-3.8-flash-high` | Plans, configures, and delegates. Edits primary workspace and configuration files (`.env*`, `opencode.jsonc`, `AGENTS.md`, `.opencode/**`, `plans/**`, `reports/**`). Never edits application code (`frontend/src/**`, `backend/src/**`). Cannot call MCP tools directly; delegates all MCP operations to `mcp-agent`. Triages tasks into Fast Track vs Full Track. Calls `code-scout` for complex code investigations, but for simple/obvious tasks dispatches directly to workers without unnecessary discovery or planning. Launches workers and reviews outputs. Never runs git commands unless explicitly instructed by the user. |
| **System Orchestrator** | `project-orchestrator` | `primary` (manual) | `cpa-gui/gemini-3.5-flash-lite` | Full-system architectural analysis. Writes report markdown files only (`*.md`, `reports/*.md`). Never edits project source files. |
| **Discovery Subagent** | `code-scout` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Locates and explains existing code, call chains, and feature relationships. Strictly read-only: no edits, no writes. Bash limited to `rg` and `node scripts/find-feature-relationships.js*`. |
| **Repository Auditor** | `repository-analyst` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits repository structure, dead/duplicate code, folder layout. Report markdown files only. No edits to source files. Read-only bash (`rg`, `node scripts/find-feature-relationships.js*`). |
| **Backend Auditor** | `backend-architect` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits controllers, services, routes, SSE streams, device isolation. Report markdown files only. No edits to source files. Read-only bash (`rg`, `node scripts/find-feature-relationships.js*`). |
| **Frontend Auditor** | `frontend-architect` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits pages, components, MUI theme registry, routing, SSE client hooks. Report markdown files only. No edits to source files. Read-only bash (`rg`, `node scripts/find-feature-relationships.js*`). |
| **Database Auditor** | `database-specialist` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits schemas, indexes, relationships, query performance. Report markdown files only. No edits to source files. Read-only bash (`rg`, `node scripts/find-feature-relationships.js*`). |
| **QA Auditor** | `qa-engineer` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits test coverage, test specs, testing gaps. Report markdown files only. No edits to source files. Read-only bash (`rg`). |
| **Security Auditor** | `security-auditor` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits security, JWT, device headers, RBAC, secrets, input validation. Report markdown files only. No edits to source files. Read-only bash (`rg`). |
| **DevOps Auditor** | `devops-engineer` | `subagent` | `cpa-gui/gemini-3.5-flash-lite` | Audits Docker, CI/CD, environment configs, logging. Report markdown files only. No edits to source files. Read-only bash (`rg`). |
| **Frontend Worker** | `fe-worker` | `subagent` | `cpa-gui/gemini-3.8-flash-high` | Implements changes strictly in `frontend/src/**` for files assigned in the plan. Never reads entire modules directly. Delegates module discovery to `code-scout` to pinpoint exact lines, then decides and executes modifications. Bash limited to `rg`, `node scripts/find-feature-relationships.js*`, and `npx tsc --noEmit`. Verifies 0 type errors before completing. Does not audit, redesign, or run dev/build/start commands. |
| **Backend Worker** | `be-worker` | `subagent` | `cpa-gui/gemini-3.8-flash-high` | Implements changes strictly in `backend/src/**` for files assigned in the plan. Never reads entire modules directly. Delegates module discovery to `code-scout` to pinpoint exact lines, then decides and executes modifications. Bash limited to `rg`, `node scripts/find-feature-relationships.js*`, and `npx tsc --noEmit`. Verifies 0 type errors before completing. |
| **MCP Worker** | `mcp-agent` | `all` | `cpa-gui/gemini-3.5-flash-lite` | Interacts with MCP tools (MongoDB queries/aggregations, Excel spreadsheets, Chrome DevTools). Read-only data operations. |

---

## Task Triage: Dual-Track Execution

Before touching tools or delegating, identify the task complexity to avoid over-engineering simple tasks:

| Track | Task Characteristics | Action |
|---|---|---|
| **Fast Track (Simple / Direct / Stack Trace)** | 1. Stack trace or error log providing file and line.<br>2. Explicit file path or function named by the user.<br>3. Single-file UI tweaks (colors, padding, labels, text, icons, simple props), typo fixes, or field mappings. | **FORBIDDEN: Do NOT call `code-scout`. Do NOT search across the codebase. Do NOT write `plans/*.md`.**<br>Delegate immediately to the single worker (`fe-worker` or `be-worker`) with the exact file path and instructions. Worker slices max 30 lines, edits, verifies via `npx tsc --noEmit`, and finishes. |
| **Full Track (Complex / Multi-file)** | Multi-file features, unknown bug investigations with NO stack trace, cross-module data flow, schema/API changes, or ambiguous multi-component refactors. | Follow the full 5-step sequence: Discovery (`code-scout`) ──▶ Plan (`plans/*.md`) ──▶ Execute (`fe-worker` / `be-worker`) ──▶ Review ──▶ Report. |

---

## Workflow

### Track A: Fast Track Workflow (Simple Tasks & Error Fixes)
1. **Zero-Discovery Rule**: If the prompt contains a stack trace, file path, line number, or straightforward field change:
   - **DO NOT launch `code-scout` or any discovery agent.**
   - **DO NOT search for callers, consumers, or references** (e.g. never grep across `frontend/src` for where a function is imported).
2. **Direct Worker Dispatch**: Immediately launch `fe-worker` or `be-worker` with:
   - Target file path (e.g. `frontend/src/components/ChatBox.tsx`)
   - Target line number / function
   - Exact instructions on what to change
3. **Verify & Report**: Worker inspects only that local slice (≤30 lines), applies the change, runs `npx tsc --noEmit`, and returns. Orchestrator confirms and reports to the user. Total tool calls for the whole task: ≤3.

### Track B: Full Track Workflow (Complex Tasks)
Used ONLY when the task spans multiple files, has unknown architecture, or involves complex logic:

```
[1. Discovery] ──▶ [2. Plan] ──▶ [3. Execute] ──▶ [4. Review] ──▶ [5. Report]
  code-scout        Primary        fe-worker       Primary             Primary
                    writes plan    be-worker       verification        to User
```

#### 1. Discovery (`code-scout`)
- For tasks with unknown locations, multi-file scope, or deep call chains, invoke `code-scout` first.
- The primary orchestrator does NOT read project source files directly.
- If specialized domain assessment is required after `code-scout`, invoke the single corresponding audit subagent (`backend-architect`, `frontend-architect`, etc.).

#### 2. Plan (Primary Orchestrator)
- The primary orchestrator synthesizes findings and writes a plan file to `plans/<feature-or-bug>.md`.
- The plan must break changes into discrete worker tasks with strict file ownership.
- The primary agent NEVER edits project code files directly.

#### 3. Execute (`fe-worker` & `be-worker`)
- The primary orchestrator delegates implementation to `fe-worker` (for `frontend/src/**`) and `be-worker` (for `backend/src/**`).
- Workers are given the exact list of files they own, the exact changes to implement, and line citations supplied by `code-scout`.
- **Worker Token-Saving Rule**: Workers are strictly forbidden from reading entire modules or large files directly. If deeper module context or exact lines are needed, the worker MUST invoke `code-scout` (using lightweight `gemini-3.5-flash-lite`). `code-scout` reviews the module, pinpoints exact line numbers, and returns findings without making any changes. The worker reviews `code-scout`'s report, decides what to modify, and executes surgical edits.
- Workers run in parallel (`background: true`) ONLY when their assigned file lists do not overlap.
- Workers MUST run `npx tsc --noEmit` in their directory to verify there are 0 TypeScript compilation or typing errors before reporting completion.

#### 4. Review (Primary Orchestrator)
- Once worker subagents complete their execution, the primary orchestrator reviews the changes and summaries.
- Verify that workers followed architectural constraints (device identity, header encoding, SSR hydration safety).
- Never run git commands during review unless explicitly requested by the user.

#### 5. Report (Primary Orchestrator)
- Report the outcome, modified files, and verification status back to the user.

---

## Plan Format

Every plan file written under `plans/*.md` MUST adhere to this structure:

```markdown
# Plan: <Task Title>

## 1. Objective
Brief description of the feature or bug fix.

## 2. Research Findings (from code-scout / auditors)
- Target components / services identified
- Interfaces, contracts, or routes involved

## 3. Worker Tasks & File Ownership

### Batch 1 (Parallel / Sequential)

#### Task 1: <Sub-task description>
- **Worker**: `fe-worker` (or `be-worker`)
- **Owned Files**:
  - `frontend/src/components/<feature>/FileA.tsx`
- **File Exclusivity Statement**: No other worker in this batch owns any of these files.
- **Specification**: Detailed instructions, state handling, props, and design rules.

#### Task 2: <Sub-task description>
- **Worker**: `be-worker` (or `fe-worker`)
- **Owned Files**:
  - `backend/src/modules/<domain>/<service>.service.ts`
- **File Exclusivity Statement**: No other worker in this batch owns any of these files.
- **Specification**: Detailed logic, routes, and error handling.

## 4. Verification & Review
Checklist for review by the primary orchestrator.
```

---

## Conflict Rules

1. **Parallel Execution Isolation**:
   - Workers may run in parallel ONLY when their file lists are strictly disjoint.
   - If two tasks require modifying the same file, they MUST run sequentially in separate batches.
2. **Strict Directory Boundaries**:
   - `fe-worker` has permission ONLY in `frontend/src/**`. It must never touch backend files or root files.
   - `be-worker` has permission ONLY in `backend/src/**`. It must never touch frontend files or root files.
3. **Auditors Never Edit**:
   - No audit agent (`repository-analyst`, `backend-architect`, `frontend-architect`, `database-specialist`, `qa-engineer`, `security-auditor`, `devops-engineer`, `code-scout`) is allowed to edit or modify project source code. They produce markdown reports only.
4. **Primary Agent Never Edits Application Code**:
   - The primary `build` agent plans, routes, configures root project files, and reviews. Its edit and write permissions strictly deny `frontend/src/**` and `backend/src/**`. Application code changes are delegated to `fe-worker` and `be-worker`.
5. **No Dangerous Commands**:
   - Never run dev, build, start, kill, taskkill, pm2, or systemctl commands.
6. **No Git Commands Without User Instruction**:
   - No agent is permitted to run any `git` command (`git status`, `git diff`, `git log`, `git commit`, `git push`, etc.) unless the user explicitly instructs to run git. In configuration, git commands are set to `"ask"` and will require explicit user confirmation.
7. **No Direct MCP by Primary Agent**:
   - The primary `build` agent cannot execute MCP tools directly. All MongoDB queries, Excel operations, and Chrome DevTools tasks must be delegated to `mcp-agent` (powered by `cpa-gui/gemini-3.5-flash-lite`).
8. **Direct `rg` Shell Usage (NEVER `npx rg`)**:
   - `ripgrep` (`rg`) is a native standalone CLI binary pre-installed directly on the system PATH (`ripgrep 15.2.0`).
   - NEVER invoke `npx rg` under any circumstances (there is no `npx rg`). Always invoke `rg` directly in the shell (e.g. `rg -i -n "pattern" frontend/src`), or use the built-in `grep` tool.
9. **Function & File Relationship Discovery (`node scripts/find-feature-relationships.js`)**:
   - All agents (orchestrator, code-scout, workers, and auditors) can and should use `node scripts/find-feature-relationships.js` to explore files and function call chains without burning tokens on broad searches.

---

## Function & Feature Relationship Tool (`scripts/find-feature-relationships.js`)

When exploring the codebase or investigating how data is retrieved or processed, agents MUST use `node scripts/find-feature-relationships.js` instead of wide grepping or reading whole files.

### 1. Function & Data Flow Trace (`--fn <name>` or `--call <endpoint>`)
Answers: **"How does data flow from frontend to backend, and what functions give the data?"**
- Command: `node scripts/find-feature-relationships.js --fn <functionName>`
  - Examples: `node scripts/find-feature-relationships.js --fn getMessages`
  - Output gives exact line numbers for:
    1. **Frontend API method**: (e.g. `frontend/src/lib/api.ts:250` `api.getMessages()`)
    2. **Frontend UI callers**: (e.g. `frontend/src/app/page.tsx:157`)
    3. **Backend Route**: (e.g. `backend/src/modules/chat/chat.route.ts:21` `GET /api/chat/messages`)
    4. **Backend Controller**: (e.g. `backend/src/modules/chat/chat.controller.ts:41` `ChatController.getMessages`)
    5. **Backend Service (Data Provider Function)**: (e.g. `backend/src/modules/chat/chat.service.ts:124` `ChatService.getMessages()`)
    6. **Database / Model Operations**: (e.g. `MessageModel.find()` at line 154)
- Command: `node scripts/find-feature-relationships.js --call <endpoint>`
  - Example: `node scripts/find-feature-relationships.js --call /api/chat/messages` or `--call /api/todos`

### 2. File Functions & Spans (`--functions`)
Answers: **"What functions exist in this file, and what are their exact line numbers?"**
- Command: `node scripts/find-feature-relationships.js --file <relPath> --functions`
  - Example: `node scripts/find-feature-relationships.js --file backend/src/modules/chat/chat.service.ts --functions`
  - Example: `node scripts/find-feature-relationships.js --file frontend/src/lib/api.ts --functions`
  - Example: `node scripts/find-feature-relationships.js --page / --functions`

### 3. File Dependency Graph (`--page`, `--file`, `--feature`)
Answers: **"What files are directly wired to this page, file, or feature?"** (~150-350 tokens)
- Command: `node scripts/find-feature-relationships.js --page <route> [--depth 1]`
- Command: `node scripts/find-feature-relationships.js --file <relPath> [--depth 1]`
- Command: `node scripts/find-feature-relationships.js --feature <keyword> [--depth 1]`
