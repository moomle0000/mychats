# MyChats 💬⚡

> A fast, private, cross-device real-time workspace for live messaging, AI prompt tools, rich media, and archived notes — powered by Next.js 16, Express, MongoDB, and Server-Sent Events (SSE).

---

## 🚀 Overview

**MyChats** is an end-to-end TypeScript application designed for instant, lightweight cross-device communication and AI assistant workflows. Post a snippet, URL, or image on your desktop, and it immediately appears on your phone or laptop in real time without the connection overhead of heavy WebSocket protocols.

The system features:
- **Global Live Chat**: A real-time room shared across all devices for instant notes and links.
- **AI Custom Tools Studio**: Create and run specialized AI assistants with custom system prompts, with conversation contexts isolated per device.
- **Rich Markdown Engine**: Code blocks with language badges, copy-to-clipboard buttons, tables, and formatting.
- **Device Attribution**: Automatic persistent device identity (`deviceId`) and visual labels (e.g. `💻 Windows PC`, `📱 Mobile`).
- **Private Admin Archive**: Role-based access control, chat history archives, and device account management.

---

## ✨ Features

### 📡 Real-Time SSE Engine
- **Server-Sent Events (SSE)**: One-way event streaming with automatic reconnection, heartbeat keep-alives, and low battery/memory consumption.
- **Instant Synchronization**: New messages and chat resets broadcast instantly across active tabs and devices.
- **Optional Redis Pub/Sub**: In-memory event dispatch by default, with seamless Redis pub/sub support for multi-instance scaling.

### 🤖 AI Custom Tools Studio (`/tools`)
- **Self-Serve AI Tool Creation**: Define custom AI tools with unique names, descriptions, and custom system prompts.
- **Device-Isolated Contexts**: Tool and translator conversations are strictly scoped to the originating device ID, keeping private queries isolated.
- **OpenAI-Compatible Proxy**: Integrates with local LLM runtimes (e.g., `llama.cpp`, vLLM, Ollama) or remote OpenAI-compatible endpoints.

### 📝 Full Markdown & Code Highlighting
- Powered by `react-markdown` and `remark-gfm` (React 19 & Next.js 16 Turbopack ready).
- **Code Blocks**: Dedicated dark-themed code containers with language badges and one-click copy feedback.
- **Inline Code**: Clean pill-styled monospaced code formatting.
- **GFM Elements**: Responsive tables, blockquotes, lists, and safe external autolinks.

### 🛡️ Multi-Account & Device Identity
- **Device Identity Tracking**: Every visitor receives a persistent unique `deviceId` stored in client storage.
- **Device Labels**: Configurable device names (e.g. `💻 Work Laptop`, `📱 Phone`) displayed directly alongside messages.
- **ASCII Header Safety**: Client and server automatically handle RFC-compliant encoding (`encodeURIComponent`) for non-ASCII/emoji device names.
- **Admin Control Panel (`/admin`)**:
  - Manage accounts and device credentials.
  - Search, inspect, rename, and delete conversation archives.
  - Reset or restore live chat sessions.

### 🎨 Material-UI Dark & Light Themes
- Built with Google Material Design (MUI 6/9) and App Router.
- Persistent light/dark mode switcher with clean theme registry.
- Fully responsive sidebar and drawer navigation for mobile and desktop.

---

## 🏗️ Architecture & Tech Stack

```
mychats/
├── backend/                  # Node.js + Express + TypeScript + Mongoose + SSE
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # Multi-account, JWT credentials, admin guards
│   │   │   ├── chat/         # Live chat, SSE streams, messages, AI proxy
│   │   │   └── tools/        # AI custom tools studio & system prompts
│   │   ├── interfaces/       # Data contracts & DTOs
│   │   ├── models/           # Mongoose schemas (User, Conversation, Message, Tool)
│   │   └── config/           # Port 5223, MongoDB, Redis, AI endpoints
│   └── package.json
├── frontend/                 # Next.js 16 (Turbopack, App Router) + MUI
│   ├── src/
│   │   ├── app/              # Routes: / (chat), /admin (manage), /login, /tools
│   │   ├── components/       # ChatBox, MessageList, MarkdownRenderer, Sidebar
│   │   ├── lib/              # api.ts (fetch client & SSE), device.ts (identity)
│   │   └── theme/            # Material UI dark/light theme registry
│   └── package.json
├── AGENTS.md                 # Agent guidelines & codebase constraints
└── README.md                 # Project documentation
```

### Technology Matrix
| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16.3.8 (Turbopack, App Router), React 19, Material-UI, Emotion |
| **Backend** | Express 4, TypeScript, Mongoose 6, TypeDI, Winston, SWC |
| **Realtime** | Server-Sent Events (`EventSource`), Redis (optional pub/sub) |
| **Database** | MongoDB |
| **Authentication** | JWT (HttpOnly cookie / Bearer header), Google OAuth |
| **Markdown** | `react-markdown`, `remark-gfm` |

---

## 🚦 Getting Started

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **MongoDB**: v5.0+ running locally or remotely
- **(Optional) Redis**: For distributed pub/sub across multiple instances

---

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/mychats.git
cd mychats
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy example environment variables
cp .env.example .env
```

Edit `.env` as needed:
```env
PORT=5223
MONGODB_URI=mongodb://localhost:27017/chatSSE
SECRET_KEY=your-secure-random-secret-key
JWT_EXPIRES_IN=30d
FRONTEND_URL=http://localhost:3000
AI_API_URL=https://myai.lmstream.xyz/v1
REDIS_ENABLED=false
```

Build and run the backend:
```bash
# Development mode (with live reload)
npm run dev

# Production build & start
npm run build
npm start
```
The API server will listen on **`http://localhost:5223`**.

---

### 3. Frontend Setup

Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Copy example environment variables
cp .env.example .env.local
```

Ensure `.env.local` points to your backend:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5223
```

Run the frontend development server:
```bash
# Development mode (Next.js Turbopack)
npm run dev

# Production build & start
npm run build
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `PORT` | `5223` | Express API port |
| `MONGODB_URI` | `mongodb://localhost:27017/chatSSE` | MongoDB connection string |
| `SECRET_KEY` | - | Random secret string used for signing JWTs |
| `JWT_EXPIRES_IN` | `30d` | JWT expiration duration |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed origin for CORS & cookies |
| `AI_API_URL` | `https://myai.lmstream.xyz/v1` | OpenAI-compatible endpoint (e.g. llama.cpp) |
| `REDIS_ENABLED` | `false` | Enable Redis pub/sub for scaling across processes |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `GOOGLE_CLIENT_ID` | - | Optional Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | - | Optional Google OAuth Client Secret |

### Frontend (`frontend/.env.local`)
| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:5223` | Base URL of the backend Express server |

---

## 📡 API Reference Overview

### Real-Time & Chat (`/api/chat`)
- `GET /api/chat/stream?conversationId=live` — Connect to SSE broadcast stream.
- `GET /api/chat/messages?conversationId=live` — Fetch message history.
- `POST /api/chat/messages` — Send a new text, link, or image message.
- `POST /api/chat/clear` — Archive current live chat and reset the room for all devices.
- `DELETE /api/chat/messages/:id` — Delete a specific message.

### AI Custom Tools (`/api/tools`)
- `GET /api/tools` — List all registered AI tools.
- `POST /api/tools` — Create a new AI tool with custom system prompts.
- `PUT /api/tools/:id` — Update tool configuration.
- `DELETE /api/tools/:id` — Remove an AI tool.

### Authentication & Users (`/api/auth`)
- `POST /api/auth/login` — Sign in with email or username + password.
- `POST /api/auth/register` — Create a new account (managed by Admin).
- `POST /api/auth/logout` — Invalidate user session and clear auth cookie.
- `GET /api/auth/me` — Retrieve current authenticated profile.

### Admin Management (`/api/admin`)
- `GET /api/admin/conversations` — View archived chat rooms.
- `GET /api/admin/conversations/:id/messages` — Read archived messages.
- `PATCH /api/admin/conversations/:id` — Rename an archived chat.
- `DELETE /api/admin/conversations/:id` — Permanently delete an archive.
- `POST /api/admin/conversations/:id/restore` — Restore an archived session back to live.

---

## 🔒 Architectural Rules & Best Practices

1. **Header Safety**:
   Custom HTTP headers (`x-device-id`, `x-device-label`) must strictly use ISO-8859-1 (ASCII). Any label containing non-Latin characters or emojis is automatically encoded with `encodeURIComponent` before transport and decoded on the backend.
2. **Device Isolation vs. Global Live**:
   - `status: 'live'` messages are shared globally with all users.
   - `status: 'translator'` and `status: 'tool'` messages are isolated per `deviceId`.
3. **SSR Hydration Guarding**:
   Dynamic timestamps rendered in client components use `suppressHydrationWarning` to prevent timezone/locale mismatches between server and client renders.

---

## 🛠️ Verification & Maintenance

Run the automated builds to verify integrity across the monorepo:

```powershell
# Verify backend build
cd backend
npm run build

# Verify frontend build & type check
cd ../frontend
npm run build
```

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
