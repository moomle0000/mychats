# Plan: Add Search Through Past Conversations in Sidebar

## 1. Objective
Add a sleek, polished search bar in the sidebar right above the "Tools & AI" section (at the top of the tools) to search through past conversations (Recent Chats / Pinned Chats) by keyword (matching title, preview text, or message contents), retrieve relevant results, and navigate directly to the chosen conversation upon clicking.

## 2. Worker Tasks & File Ownership

### Task 1: Backend Search Enhancement
- **Worker**: `be-worker`
- **Owned Files**:
  - `backend/src/modules/chat/chat.service.ts`
- **Specification**:
  - Update `listArchives` method to support searching not only by `title` and `previewText`, but also by finding message contents (`MessageModel.find({ text: regex })`) matching the search keyword.

### Task 2: Frontend Sidebar Search Bar & Integration
- **Worker**: `fe-worker`
- **Owned Files**:
  - `frontend/src/app/page.tsx`
  - `frontend/src/components/Sidebar.tsx`
- **Specification**:
  - In `page.tsx`: Update `loadSidebarConversations` to accept a `search` query parameter and pass `searchQuery`, `onSearchChange`, etc., or handle sidebar search fetching.
  - In `Sidebar.tsx`:
    - Add a sleek, polished search bar between the "+ New chat" button and the "Tools & AI" collapsible section.
    - Include a search icon (`SearchRounded`), clear button (`CloseRounded`), and placeholder ("Search past chats...").
    - Trigger search/filtering (debounced API call or state filtering).
    - Render search results clearly, and when a result is clicked, invoke `onSelectConversation(conv._id)` to take the user directly to that conversation.

## 3. Verification
- Verify TypeScript compilation with `npx tsc --noEmit` in both `backend/` and `frontend/`.
