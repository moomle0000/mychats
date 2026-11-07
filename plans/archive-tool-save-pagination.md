# Plan: Clear & Archive Fix, Tool Conversation Archiving, and Sidebar Pagination

## 1. Objective
Implement three fixes and enhancements across the backend and frontend:
1. **Clear & Archive (No Limit & Immediate Move)**: Remove any restriction/minimum count check so clearing & archiving moves everything directly to "Recent Chats" immediately, regardless of message quantity (including 0 messages), with no arbitrary limits.
2. **Preventing Data Loss on Tool Clear**: Stop permanently deleting tool and translator conversations. Instead, archive the active tool/translator conversation into past conversations (`status: 'archived'`) with an informative title, save its message history, and create a clean active tool session so records are never lost.
3. **Recent Chats Sidebar Pagination**: On initial page load, display the 10 most recent chats. When scrolling down the sidebar conversation list, load 10 additional chats progressively (infinite scroll).

---

## 2. Research Findings
- **Backend `clearAndArchive`**: Line 425 of `backend/src/modules/chat/chat.service.ts` threw `HttpException(400)` when `count === 0`.
- **Backend `clearToolConversation` & `clearTranslator`**: Lines 475–497 of `backend/src/modules/chat/chat.service.ts` called `MessageModel.deleteMany`, completely wiping messages and never archiving tool chats.
- **Frontend `ChatToolbar`**: Lines 294 and 316 of `frontend/src/components/ChatToolbar.tsx` disabled the button when `!hasMessages`.
- **Frontend `page.tsx` & `Sidebar.tsx`**: `loadSidebarConversations` was not called after tool clearing in `handleClear`. `api.getSidebarConversations` requested `limit: 100` with no pagination. `Sidebar.tsx` lacked scroll-based pagination hooks.

---

## 3. Worker Tasks & File Ownership

### Batch 1 (Parallel Execution)

#### Task 1: Backend Architecture — Archive Logic & Zero Data Loss
- **Worker**: `be-worker`
- **Owned Files**:
  - `backend/src/modules/chat/chat.service.ts`
- **File Exclusivity Statement**: No other worker in this batch owns any backend files.
- **Specification**:
  1. In `clearAndArchive()`:
     - Remove the `if (count === 0) throw new HttpException(400, ...)` guard.
     - Allow archiving regardless of quantity. If `count === 0`, set title to `Chat ${dateStr} (0 msgs)` (or first line if non-AI text exists).
     - Save conversation as `status: 'archived'`, set `archivedAt`, and create fresh live conversation.
  2. In `clearToolConversation()`:
     - Remove `MessageModel.deleteMany({ conversationId: conv._id })`.
     - Query tool details for title (e.g. `[${tool.title}] ...`).
     - Query first line of first non-AI message for title, or fallback to timestamp and count.
     - Save `conv.status = 'archived'`, `conv.title = archiveTitle`, `conv.archivedAt = now`, `conv.messageCount = count`.
     - Create a fresh new tool conversation (`status: 'tool'`, `toolId`, `deviceId`, title, `messageCount: 0`).
     - Broadcast `chat:tool-reset`.
  3. In `clearTranslator()`:
     - Remove `MessageModel.deleteMany`.
     - Archive existing translator conversation (`status = 'archived'`, `title = archiveTitle`, `archivedAt = now`, `messageCount = count`).
     - Create fresh new translator conversation (`status: 'translator'`, `deviceId`, `messageCount: 0`).
     - Broadcast `chat:translator-reset`.
  4. Verify typecheck passes via `cd backend; npx tsc --noEmit` with 0 errors.

#### Task 2: Frontend Implementation — Toolbar, API, Page, and Sidebar Pagination
- **Worker**: `fe-worker`
- **Owned Files**:
  - `frontend/src/lib/api.ts`
  - `frontend/src/components/ChatToolbar.tsx`
  - `frontend/src/app/page.tsx`
  - `frontend/src/components/Sidebar.tsx`
- **File Exclusivity Statement**: No other worker in this batch owns any frontend files.
- **Specification**:
  1. `frontend/src/lib/api.ts`:
     - Update `getSidebarConversations(page = 1, limit = 10, search = '')` to send `page` and `limit` query parameters, returning `{ data: Conversation[]; total: number; page: number; totalPages: number }`.
  2. `frontend/src/components/ChatToolbar.tsx`:
     - Enable the "Clear & Archive" / "Clear Tool Chat" button regardless of message count (change `disabled={!hasMessages}` to `disabled={clearing}`).
     - Update tooltips to match.
  3. `frontend/src/app/page.tsx`:
     - Add pagination state: `sidebarPage`, `hasMoreSidebar`, `loadingMoreSidebar`.
     - Update `loadSidebarConversations(page = 1, append = false)`:
       - Fetch with `limit = 10`.
       - If `page === 1`, set `conversations` to `res.data || []`.
       - If `append === true`, de-duplicate and append to `conversations`.
       - Update `sidebarPage` and `hasMoreSidebar = res.page < res.totalPages && res.data.length > 0`.
     - In `handleClear`:
       - Call `loadSidebarConversations(1)` for BOTH live chat and tool chat clears, so the archived conversation shows up in Recent Chats immediately.
     - Pass `onLoadMoreSidebar`, `hasMoreSidebar`, and `loadingMoreSidebar` to `<Sidebar ... />`.
  4. `frontend/src/components/Sidebar.tsx`:
     - Update `SidebarProps` to include `onLoadMore?: () => void; hasMore?: boolean; loadingMore?: boolean;`.
     - On the conversations list scroll container (`Box`), add `onScroll` handler to detect scrolling near bottom (`scrollHeight - scrollTop - clientHeight < 80`) and invoke `onLoadMore`.
     - Add an IntersectionObserver / sentinel at the bottom of the list for smooth infinite scrolling.
     - Show `<CircularProgress size={18} />` indicator when `loadingMore` is true.
  5. Verify typecheck passes via `cd frontend; npx tsc --noEmit` with 0 errors.

---

## 4. Verification & Review
1. Run `cd backend; npx tsc --noEmit` -> 0 errors.
2. Run `cd frontend; npx tsc --noEmit` -> 0 errors.
3. Review changes for architectural constraints (header encoding, SSR hydration safety, device isolation).
