# Architecture Overview

## Modules
- `apps/api/src/routes`: route layer (`/auth`, `/documents`, `/share`)
- `apps/api/src/models`: Mongo models (`User`, `Document`, `DocumentPermission`, `EditingSession`)
- `apps/api/src/services`: business logic (`editing-policy`, access checks, token generation)
- `apps/api/src/middleware`: auth, validation, error envelope
- `apps/web/src/pages`: route pages (`/login`, `/register`, `/drive`, `/documents/:id`, `/shared/:token`)
- `apps/web/src/api/client.ts`: typed HTTP wrapper
- `apps/web/src/context/AuthContext.tsx`: auth state and session bootstrap

## Data model summary
- `User`: account credentials and display name
- `Document`: plain text content and owner
- `DocumentPermission`: editor rights for existing users
- `EditingSession`: legacy edit-session compatibility model (lock no longer enforced in multi-writer mode)

## API summary
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Documents: list/create/get/update/delete
- Permissions: add/remove/list editors (owner only)
- Share links: create/revoke read token + public read endpoint
- Edit sessions: start/heartbeat/end/status

## Concurrency abstraction
- `EditingPolicy` interface introduced for future extension.
- Current implementation: `MultiWriterPolicy` (no lock blocking).
- Realtime collaboration is handled by Socket.IO document rooms with live content broadcast + debounced persistence.
