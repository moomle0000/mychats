# Plan: Refactor Search into a Separate Interactive Overlay/List with Keyword Jump

## 1. Objective
Refactor sidebar conversation search so that:
1. Search results appear in a **separate dedicated dropdown / popup / overlay panel** (or view) underneath the search bar rather than mixing inline into the Recent Chats list.
2. Clicking a search result navigates directly to the target conversation AND scrolls to / highlights the exact matching message containing the keyword.

## 2. Worker Tasks & File Ownership

### Task 1: Backend Search Result Details Enhancement
- **Worker**: `be-worker`
- **Owned Files**:
  - `backend/src/modules/chat/chat.service.ts`
- **Specification**:
  - Update search results (or add a dedicated search messages/conversations endpoint or enhance `listArchives` return data) so that search results include matching message snippets / message IDs (`matchedMessageId` or snippet text) so the frontend can jump directly to the exact message.

### Task 2: Frontend Dedicated Search Overlay & Keyword Jump
- **Worker**: `fe-worker`
- **Owned Files**:
  - `frontend/src/lib/api.ts`
  - `frontend/src/app/page.tsx`
  - `frontend/src/components/Sidebar.tsx`
  - `frontend/src/components/MessageList.tsx`
- **Specification**:
  - **Sidebar.tsx**: Render search results in a sleek, isolated popup/dropdown container below the search bar (hidden when search query is empty). Show conversation title, preview/matching snippet, and timestamp.
  - **page.tsx & api.ts**: When a search result with a `matchedMessageId` or conversation is clicked, switch to that conversation and scroll/highlight the matching message in `MessageList.tsx`.
  - **MessageList.tsx**: Support highlighting or scrolling to a specific message ID when navigating from search.

## 3. Verification
- Verify TypeScript compilation with `npx tsc --noEmit` in both `backend/` and `frontend/`.
