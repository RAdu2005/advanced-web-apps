# Mandatory Cloud Drive - Documentation

## Technology choices
- Backend: Node.js + TypeScript + Express + MongoDB/Mongoose
- Frontend: React + Vite + TypeScript + TailwindCSS
- Auth: JWT stored in HttpOnly cookie
- Validation: Zod
- Tests: Vitest (+ Supertest for backend, Testing Library for frontend)

## Project structure
- `apps/api`: REST API
- `apps/web`: React UI
- `docs`: project documentation

## Installation and run
1. Install dependencies:
```bash
npm install
```
2. Configure API env:
```bash
copy apps/api/.env.example apps/api/.env
```
3. Start MongoDB locally (default expected: `mongodb://127.0.0.1:27017/cloud_drive`).
4. Run API and Web in separate terminals:
```bash
npm run dev:api
npm run dev:web
```
5. Open `http://localhost:5173`.

## Environment variables
API (`apps/api/.env`):
- `PORT` default `4000`
- `MONGO_URI` default local MongoDB URI
- `JWT_SECRET` required
- `JWT_EXPIRES_IN` default `7d`
- `CORS_ORIGIN` default `http://localhost:5173`
- `EDIT_SESSION_TTL_SECONDS` default `300`

## User manual
1. Register an account.
2. Login and enter Drive.
3. Create, rename, open, and delete your text documents.
4. In editor:
- Update title/content and save.
- Generate or revoke read-only public share link.
- Add/remove editor permissions by email (owner only).
5. If another user edits the same document, you will see lock information and editing is disabled.
6. Logout from the Drive page.

## Notes
- Public shared links are read-only.
- Only owner can delete docs, manage editors, and share links.

