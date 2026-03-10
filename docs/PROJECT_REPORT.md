# Cloud Drive Project Report

## 1. Project Summary
This project implements a cloud-drive style application where users can register, log in, create/edit/delete text documents, share read-only links, and collaborate in real time.  
The codebase is a TypeScript monorepo with separate backend (`apps/api`) and frontend (`apps/web`) applications.

## 2. Technology Choices

| Layer | Choice | Why this was chosen |
| :--- | :--- | :--- |
| Backend runtime | Node.js + TypeScript | Matches rubric requirements and keeps type-safe contracts across API/domain code |
| HTTP framework | Express | Lightweight routing/middleware model with good ecosystem support |
| Database | MongoDB + Mongoose | Matches rubric requirement; document model fits text-document domain well |
| Auth | JWT in HttpOnly cookie | Protects token from JS access and supports browser session UX |
| Validation | Zod | Runtime validation with strongly typed schemas |
| Frontend | React + TypeScript + Vite | Fast development/build pipeline and component-based UI architecture |
| UI styling | Tailwind CSS | Rapid responsive UI implementation with consistent utility classes |
| Realtime | Socket.IO | Handles real-time collaboration channels with reconnect/fallback support |
| Rich text editor | ReactQuill (Quill) | Delivers WYSIWYG editing capability required for optional points |
| PDF export | quill-to-pdf | Converts Quill delta to downloadable PDF |

## 3. Architecture and Design Choices

### 3.1 Monorepo and module boundaries
- Root workspace (`package.json`) manages two apps: `apps/api` and `apps/web`.
- This separation keeps API concerns (auth/data/security) independent from UI concerns while sharing one repository and one dependency graph.

### 3.2 Backend architecture (`apps/api`)
- Layered structure:
  - `routes`: HTTP endpoints and orchestration.
  - `services`: domain policies and access checks.
  - `models`: Mongo schemas.
  - `middleware`: auth, validation, and error envelope.
  - `realtime`: Socket.IO collaboration server.
- Centralized error model:
  - `AppError` standardizes status/code/message.
  - Global `errorHandler` returns consistent JSON errors.
- Input validation:
  - Zod schemas for auth/document payloads.
  - `validateBody` middleware rejects malformed input with `422`.

### 3.3 Data model choices (MongoDB)
- `User`:
  - Stores `email`, `passwordHash`, `displayName`, optional `avatarPath`.
  - Email uniqueness is enforced.
- `Document`:
  - Stores owner, title, content, timestamps, optional `sharedReadToken`, and `deletedAt` for soft delete.
- `DocumentPermission`:
  - Explicit per-user editor rights with unique `(documentId, userId, role)` index.
- `EditingSession`:
  - TTL-based lease model kept for compatibility, though current collaboration mode is multi-writer.

### 3.4 Authentication and security
- Registration/login use bcrypt password hashing.
- JWT is signed server-side and stored in an HttpOnly cookie (`token`).
- Protected routes use `requireAuth` middleware.
- CORS allowlist is controlled via `CORS_ORIGIN` env var.
- Avatar upload uses MIME/type + size restrictions and safe server-side filename generation.

### 3.5 Authorization and sharing
- Ownership and access are separated:
  - Owners have full control.
  - Editors are granted via `DocumentPermission`.
- Access rules are centralized in `document-access.ts` (`assertOwner`, `assertCanAccessDocument`).
- Public sharing uses random read token (`/share/:token`) and is intentionally read-only.

### 3.6 Collaboration strategy
- Real-time collaboration uses Socket.IO document rooms.
- Design choices:
  - In-memory per-room state for low-latency updates.
  - Debounced persistence to MongoDB (`600ms`) to avoid write amplification.
  - Presence broadcasting (`presence_update`) for active collaborator count.
  - Last-user-leaves flush to persist pending changes.
- `EditingPolicy` abstraction exists for swapping concurrency approaches; current implementation is `MultiWriterPolicy` (non-locking).

### 3.7 Frontend architecture (`apps/web`)
- Routing:
  - Public: `/login`, `/register`, `/shared/:token`.
  - Protected: `/drive`, `/documents/:id` via `ProtectedRoute`.
- State strategy:
  - `AuthContext` for session state/bootstrap (`/auth/me` on load).
  - `ThemeContext` for dark/light persistence in `localStorage`.
- API integration:
  - Single typed client (`src/api/client.ts`) centralizes endpoint calls and error handling.
- Feature UI mapping:
  - `DrivePage`: create/list/sort/delete/clone/restore/empty-trash, avatar upload, metadata display.
  - `EditorPage`: WYSIWYG editor, realtime sync, share link management, editor permissions, PDF export.
  - `SharedPage`: anonymous read-only rendering.

### 3.8 Key tradeoffs
- Realtime currently broadcasts content updates at document level (simple, robust for coursework scope) rather than full CRDT/OT conflict resolution.
- Soft delete + recycle bin improves safety/usability and prevents immediate hard-loss.
- JWT in cookie favors browser usability and security over manual token handling complexity on frontend.

## 4. Installation and Run Guide

### 4.1 Prerequisites
- Node.js (LTS recommended)
- npm
- MongoDB running locally (`mongodb://127.0.0.1:27017/cloud_drive`)

### 4.2 Setup
1. Install dependencies:
```bash
npm install
```
2. Create API env file:
```bash
copy apps/api/.env.example apps/api/.env
```
3. Configure env values in `apps/api/.env`:
  - `PORT` (default `4000`)
  - `MONGO_URI`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN` (default `7d`)
  - `CORS_ORIGIN` (default `http://localhost:5173`)
  - `EDIT_SESSION_TTL_SECONDS` (default `300`)

### 4.3 Run (development)
Open two terminals:
```bash
npm run dev:api
```
```bash
npm run dev:web
```
Then open `http://localhost:5173`.

### 4.4 Build
```bash
npm run build
```

## 5. User Manual
1. Register a new account, then log in.
2. In Drive:
  - Create new documents.
  - Rename, clone, open, and delete (to recycle bin).
  - Restore documents from recycle bin or empty it permanently.
  - Sort by name/created/updated.
3. In Editor:
  - Edit title/content in WYSIWYG mode.
  - Save manually (in addition to realtime syncing).
  - Collaborate live with other authorized users.
  - Generate/revoke read-only public share links.
  - Add/remove editor permissions (owner only).
  - Download current document as PDF.
4. Upload a profile picture from the Drive header.
5. Toggle dark/light theme.
6. Log out.
7. Non-authenticated users can open `/shared/:token` links in read-only mode.

## 6. Features and Points Table (Rubric-Based)

### 6.1 Base score

| Item | Points |
| :--- | ---: |
| Mandatory functionality + documentation | 25 |

**Base subtotal: 25**

### 6.2 Optional features implemented

| Optional Feature (from rubric) | Implemented | Points |
| :--- | :---: | ---: |
| Multiple Users (real-time collaboration) | Yes | 8 |
| Frontend Framework (React) | Yes | 3 |
| PDF Download | Yes | 3 |
| WYSIWYG editor integration | Yes | 2 |
| Profile Picture | Yes | 2 |
| Recycle Bin | Yes | 2 |
| Metadata Display (created/updated timestamps) | Yes | 1 |
| Sorting | Yes | 1 |
| Dark Mode | Yes | 1 |
| Cloning | Yes | 1 |

**Optional subtotal: 24**

### 6.3 Not claimed / not implemented for points

| Optional Feature | Status |
| :--- | :--- |
| Spreadsheets | Not implemented |
| Comments | Not implemented |
| Folders | Not implemented |
| Testing bonus (10+ cases) | Not claimed |
| Slides | Not implemented |
| Translation | Not implemented |
| Search | Not implemented |
| Pagination | Not implemented |

### 6.4 Deductions check

| Deduction Category | Current status |
| :--- | :--- |
| Application does not work (-100) | Not observed |
| No documentation (-100) | No |
| Missing basic parts (0 to -25) | No |
| Messy project structure (0 to -10) | No |
| TypeScript issues (0 to -10) | No major issues observed |
| Non-English code/comments (-10) | No |
| No comments (-10) | No |
| Bad comments (-5) | No major issues observed |

**Deductions applied in this estimate: 0**

### 6.5 Total estimate

| Calculation | Points |
| :--- | ---: |
| Base (25) + Optional (24) - Deductions (0) | **49 / 50** |

## 7. Compliance Notes
- Required stack constraints are satisfied: Node.js + TypeScript backend, MongoDB database, English UI.
- App is responsive for desktop/mobile using Tailwind utility layout classes.
- Authenticated access gates protected features; shared links remain read-only.
- Active ports are standard development ports (`4000` API, `5173` web), far below the rubric's 60k limit.
