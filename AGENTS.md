# MyChats — Agent Guidelines & Architecture Rules

This file guides AI agents to operate at maximum efficiency, reach desired outcomes faster, and minimize token consumption while maintaining the architectural integrity of the **MyChats** codebase.

---

## 1. Project Architecture & Technology Stack

The project is structured as a two-tier TypeScript monorepo:

```
mychats/
├── backend/                  # Node.js + Express + TypeScript + Mongoose + SSE
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # Multi-account & device credentials, JWT auth
│   │   │   ├── chat/         # Live chat, SSE broadcasts, messages, AI proxy
│   │   │   └── tools/        # AI custom tools studio & system prompts
│   │   ├── interfaces/       # Mongoose & DTO interfaces
│   │   └── config/           # Port 5223, MongoDB, llama.cpp endpoint
│   └── package.json
├── frontend/                 # Next.js 16 (Turbopack, App Router) + MUI + SSE
│   ├── src/
│   │   ├── app/              # Routes: / (chat), /admin (manage), /login, /tools
│   │   ├── components/       # ChatBox, ChatToolbar, MessageList, Sidebar
│   │   ├── lib/              # api.ts (fetch client), device.ts (identity)
│   │   └── theme/            # Material UI dark/light color mode registry
│   └── package.json
└── AGENTS.md                 # Agent guidelines (this file)
```

- **Backend Port**: `5223` (Express API + SSE streams)
- **Frontend Port**: `3000` (Next.js)
- **AI Model Endpoint**: `https://myai.lmstream.xyz/v1` (llama.cpp OpenAI-compatible API)

---

## 2. Token-Efficiency & Speed Optimization Rules

To minimize token usage and accelerate task completion, agents MUST adhere to:

1. **Precision File Edits**:
   - Use `replace_file_content` for targeted modifications. NEVER rewrite an entire file with `write_to_file` when changing only a subset of lines.
2. **Targeted Reading**:
   - Use `view_file` with explicit `StartLine` and `EndLine` ranges rather than reading large files in full.
   - Never run recursive file searches across `node_modules`, `.next`, or `dist`.
3. **No Redundant Echoing**:
   - Do not output repetitive code explanations or echo entire file contents into the chat conversation.
   - Keep final answers concise: state the root cause, files edited, and verification outcome.
4. **Fast Local Verification**:
   - Verify changes using `npm run build` in either `backend/` or `frontend/`.
   - Run type checks directly rather than guessing.

---

## 3. Core Architectural Constraints & Patterns

### A. Device Identity & Header Safety
- **Every device** visiting the site receives a persistent device identifier (`deviceId`) stored in `localStorage` and sent with requests via `x-device-id`.
- **HTTP Header Encoding Rule**: HTTP headers must strictly contain **ISO-8859-1 (ASCII)** characters. Any header containing emojis (e.g. `💻 Windows PC`) or non-Latin text (e.g. Arabic) **must be encoded** with `encodeURIComponent` on client (`frontend/src/lib/api.ts`) and decoded on backend (`backend/src/modules/chat/chat.controller.ts`).
- Failure to encode non-ASCII headers causes: `Failed to execute 'set' on 'Headers': String contains non ISO-8859-1 code point`.

### B. Shared Live Chat vs. Isolated Chat Tools
- **Live Chat (`status: 'live'`)**:
  - Globally shared across all devices and users in real time.
  - Messages display the sender's origin `deviceLabel` (e.g. `💻 Work Laptop`).
  - Clearing live chat creates an archive in the database and resets the live room for all devices.
- **Chat Tools (`status: 'translator'` or `status: 'tool'`)**:
  - **Device-Isolated**: Each device has its own isolated conversation context tied to `deviceId`.
  - Tool messages and translations are **NOT** shared across devices.
  - SSE broadcasts for tools are filtered so only the originating `targetDeviceId` receives the update.
  - Clearing a tool only clears the current device's tool conversation.

### C. Authentication & Privacy
- **Public Registration Disabled**: The application is private. Only the authenticated admin can create additional device accounts in `/admin`.
- **Unauthenticated Viewers**: Users who are not logged in can only use the Live Chat and Tools; sidebar archives/history remain hidden.
- **Safety Guards**: Admins cannot delete their own active account or the last remaining admin account.

### D. Next.js 16 SSR & Hydration
- Date/time formatting rendered in client components must use `suppressHydrationWarning` on the wrapping element to avoid SSR/client locale timestamp mismatches.
- Avoid accessing `window` or `localStorage` during initial server render without checking `typeof window !== 'undefined'`.

---

## 4. Quick Verification Commands

```powershell
# Fast type-check backend (no full build, safe to run while app is live)
cd backend; npx tsc --noEmit

# Fast type-check frontend (no full build, safe to run while app is live)
cd frontend; npx tsc --noEmit

# Check running ports (read-only, never kills the running app)
Get-NetTCPConnection -LocalPort 5223, 3000 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
```
