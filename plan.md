# MyChats — Comprehensive Upgrade Plan
**Site:** https://c.lmstream.xyz/ | **Date:** 2026-10-05
**Goal:** Turn the temporary WebSocket chat scratch-space into a fast, private, cross-device store for links/images/notes with SSE realtime, MUI Next.js UI, dual auth, and a private Admin archive.

---

## 1. Current State (verified)

### 1.1 Live site
- CRA + Chakra UI + Socket.io client (`engine.io`, default path `/engine.io`).
- UI: `Type a message...` textarea + 4 toolbar buttons (all labelled "Search database" — trash/clear, refresh, network, code) + `CHAT SOCKET` pill + empty message area.
- Socket server appears down/empty; `/socket.io`, `/ws`, `/api`, `/messages` all return SPA fallback HTML.
- Console: 1 module-MIME error (`/src/main.jsx` served as HTML), 1 CORB-blocked favicon chain.

### 1.2 Local workspace `D:\Admin\Developer\Home\mychats\`
- `backend/` — Express 4 + TS + Typedi + Mongoose 6 + ioredis template named `chatSSE-backend`. **Does not compile today.**
- `frontend/` — empty, reserved for Next.js 16.3.8.
- `plan.md` — this file.

### 1.3 Backend template findings
- `src/app.ts`: `trust proxy`, `cors` (allows `lmstream.xyz` + localhost/192.168), `helmet`, `hpp`, `compression`, `express.json({10mb})`, `cookieParser`, `ErrorMiddleware`, Swagger at `/api-docs`. Mounts `appRoutes`.
- `src/server.ts`: `clearCacheOnStartup() → redis.flushdb()`.
- Auth: JWT-only (`SECRET_KEY`, `JWT_EXPIRES_IN=30d`), `Authorization: Bearer` header → fallback `req.cookies['Authorization']`. No OAuth.
- `src/middlewares/auth.middleware.ts` references **missing** files: `@interfaces/auth.interface`, `@models/user.model`, `@models/tenant.model`, `@middlewares/tenant.middleware`, `StudentModel`. Must fix or strip.
- `src/modules/index.ts` imports 7 modules that **don't exist on disk** (`academic-student`, `assessment-grading`, `billing-fees`, `finance-accounting`, `tax-vat`, `hr-payroll`, `admin-core`). Only `tenant/` exists. Zero `.model/.route/.controller/.service` files.
- Redis client exists (`src/config/redis.ts`, `REDIS_URL=redis://192.168.0.12:6379`, prefix `chatSSE:`) but only used for `flushdb` — free to reuse for SSE pub/sub.
- No SSE / WebSocket code. No `socket.io`/`ws` dependency.
- Env (`backend/.env`): `PORT=5223`, `MONGODB_URI=mongodb://192.168.0.12:27017/chatSSE`, `REDIS_URL=redis://192.168.0.12:6379`, `ORIGIN=*`.

---

## 2. Decisions (locked with user)
| # | Decision | Choice |
|---|----------|--------|
| 1 | Realtime transport | **SSE (Server-Sent Events)**, drop WebSockets/Socket.io |
| 2 | Frontend | **Next.js 16.3.8 App Router + MUI (Google Material)** in `frontend/` |
| 3 | Auth | **Both: email/username+password AND Google OAuth** (GitHub later) |
| 4 | Clear button | **Move + clear live**: archive current conversation, start fresh empty live chat on all devices |
| 5 | Privacy | Live chat stays open-post; **archives visible only after login in `/admin`** |
| 6 | Tenancy | Single-user personal use → simplify `tenantId` to constant `personal` |

---

## 3. Target Architecture

```
[Browser A/B] ──HTTPS──> [Next.js 16 (frontend/:3000)] ──REST/SSE──> [Express API (backend/:5223)]
      │                           │ middleware.ts (JWT cookie guard /admin)      │
      │                           │ app/api/* proxy (sets httpOnly cookie)       │
      │                                                                     MongoDB (conversations, messages, users)
      │                                                                     Redis pub/sub (chatSSE:chat:<convId>)
```

- **Why SSE:** one-way broadcast fits "post link on PC, read on phone"; auto-reconnect via `EventSource`; no sticky sessions; Cloudflare/Nginx friendly.
- **Why proxy via Next Route Handlers:** keeps `SECRET_KEY` server-side, avoids CORS, allows httpOnly cookie.
- **Why one JWT for both logins:** backend is source of truth; Google `idToken` verified server-side, upserted to same `User` collection.

---

## 4. Data Models (new `backend/src/modules/chat/` + `auth/`)

```ts
User { email unique, username unique, passwordHash?, oauthProvider?: 'google'|'github',
       oauthId?, avatarUrl?, role: 'admin'|'user' (default 'admin' for owner), isActive, lastLoginAt }
Conversation { status: 'live'|'archived', title, messageCount, previewText,
               startedAt, archivedAt?, createdAt }
Message { conversationId ref, kind: 'text'|'link'|'image', text, url?, mime?, size?, createdAt }
```

- Exactly **one** `status='live'` conversation at a time.
- `Clear` transaction: `live → archived{title auto: "Chat 2026-10-05 09:12 (42 msgs)"}` + insert fresh `live` + publish `chat:archived` + `chat:live-reset`.
- Images: existing `multer` middleware → `uploads/` (S3 later). Indexes: `Conversation(status, archivedAt desc)`, `Message(conversationId, createdAt)`.

---

## 5. API Contract (backend)

### Auth — `POST /api/auth/*`
- `POST /api/auth/register {email, username, password}` → 201 + JWT cookie
- `POST /api/auth/login {email|username, password}` → JWT cookie
- `POST /api/auth/oauth/google {idToken}` → verify via `google-auth-library`, upsert user, JWT cookie
- `POST /api/auth/logout` → clear cookie | `GET /api/auth/me` → current user

### Chat (open post, history read)
- `GET /api/chat/stream?conversationId=live` → `text/event-stream`, heartbeat 25s, events: `message:new`, `chat:live-reset`, `chat:archived`
- `GET /api/chat/messages?conversationId=&limit=50&before=` → history (cross-device sync)
- `POST /api/chat/messages {text, imageUrl?}` → save + `redis.publish` → all SSE clients <1s
- `POST /api/chat/clear` → archive + new live (confirm dialog client-side)

### Admin (Auth required)
- `GET /api/admin/conversations?q=&page=&limit=` → archived list
- `GET /api/admin/conversations/:id/messages` → full view
- `PATCH /api/admin/conversations/:id {title}` → rename
- `DELETE /api/admin/conversations/:id` → delete
- `POST /api/admin/conversations/:id/restore` → make live again
- `GET /api/admin/stats` → counts (archives, messages, storage)

---

## 6. Frontend Routes (Next.js 16.3.8 + MUI)

```
frontend/src/
  app/
    layout.tsx                     # MUI ThemeProvider + CssBaseline + GoogleOAuthProvider
    page.tsx              '/'      # Chat: MUI Container+Card, multiline TextField, paste-image, link preview, Enter-send
    login/page.tsx        '/login' # Tabs: Email|Google (@react-oauth/google)
    admin/page.tsx        '/admin' # PROTECTED: stat cards, Archive DataGrid, search, drawer view, rename/delete/restore/export .md/.json
    api/auth/[...]/route.ts        # proxy → backend, sets httpOnly JWT cookie
  components/ ChatBox.tsx MessageList.tsx ChatToolbar.tsx ArchiveTable.tsx ConversationDrawer.tsx LinkPreview.tsx
  hooks/useSSE.ts                  # EventSource + exponential reconnect + ...before pagination
  lib/api.ts theme.ts
  middleware.ts                    # if /admin && !JWT cookie → /login
```

MUI toolbar replaces 4 cryptic buttons: **Clear & Archive (delete + confirm) | Reconnect | Admin | Logout**.

---

## 7. Build Phases

### Phase 0 — Fix baseline (must do first, ~30 min)
1. Prune `src/modules/index.ts` to only existing + new `auth`/`chat` routes.
2. Add missing `src/interfaces/auth.interface.ts` (`DataStoredInToken{id,tenantId,role}`); stub or remove `tenant.middleware` + `StudentModel`/`TenantModel` refs (single-tenant `personal`).
3. `npm run dev` boots on `:5223`, Mongo+Redis connect.

### Phase 1 — Auth (dual)
- `user.model.ts` (bcrypt pre-save), `auth.service.ts` (register/login/Google verify + `sign({id,tenantId:'personal',role})`), `auth.route/controller`, register in `modules/index.ts`.
- Deps: `+ google-auth-library`. Env: `GOOGLE_CLIENT_ID`, `FRONTEND_URL`, `JWT_COOKIE_SECURE`.

### Phase 2 — Chat + SSE
- `conversation/message` models, `chat.service`, `sse.service` (Redis pub/sub `chatSSE:chat:<id>`, in-process fallback), `chat.route` (stream/messages/clear with no-compression SSE headers).

### Phase 3 — Next.js + MUI chat
- Scaffold per §6, `useSSE`, paste-image upload, link auto-detect.

### Phase 4 — Admin (private archives)
- `middleware.ts` guard, DataGrid + drawer, rename/delete/restore/export.

### Phase 5 — Cutover `c.lmstream.xyz`
- Deploy backend `:5223` + frontend `:3000`, Nginx/Cloudflare reverse-proxy, `ORIGIN=https://c.lmstream.xyz`, `Secure` cookies, retire Socket.io DNS.

---

## 8. File Changes Checklist
- **Backend create:** `src/modules/auth/{user.model,auth.service,auth.controller,auth.route}.ts`, `src/modules/chat/{conversation.model,message.model,chat.service,sse.service,chat.route}.ts`, `src/interfaces/auth.interface.ts`
- **Backend edit:** `src/modules/index.ts`, `src/app.ts` (SSE headers), `package.json`, `.env` (+Google vars)
- **Frontend create:** everything under `frontend/src/` per §6 (fresh `npx create-next-app@16.3.8 frontend --typescript --eslint --app --src-dir --import-alias "@/*" --turbopack` + `npm i @mui/material @mui/icons-material @emotion/react @emotion/styled @react-oauth/google`)

---

## 9. Verify
1. `backend npm run dev` + `frontend npm run dev` both boot.
2. Register → login → JWT httpOnly cookie; Google login same; logged-out `/admin` → `/login`.
3. Two browsers on `/`: post in one → appears in other <1s.
4. Paste image + link → renders on second device.
5. `Clear` → live empties everywhere, new archive row in `/admin`.
6. `tsc --noEmit` + `next build` green.

## 10. Risks
- Template doesn't compile until Phase 0 pruning — do that before any feature.
- Next 16.3.8 is bleeding-edge: pin exact version, keep Turbopack default, test MUI Emotion cache for RSC flicker.
- `REDIS_ENABLED=true` + `flushdb()` on boot wipes pub/sub on restart — move flush to dev-only.
- Single `live` conversation: guard concurrent `clear` with atomic `findOneAndUpdate`.

---
*Next action: approve → Phase 0 baseline fix.*
