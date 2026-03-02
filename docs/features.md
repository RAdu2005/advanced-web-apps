# Features and Points

## Implemented mandatory features (base target 25 points)

| Feature | Implemented |
| :--- | :--- |
| Node.js + TypeScript backend | Yes |
| MongoDB persistence | Yes |
| Register/login/logout | Yes |
| Auth-only access to drive/doc APIs | Yes |
| Text document CRUD (add/remove/rename/edit) | Yes |
| Grant edit permission to existing users | Yes |
| Share read-only by link to non-auth users | Yes |
| Prevent simultaneous editing (single active editor lock) | Replaced by multi-user realtime editing |
| Recover editing session after accidental tab close (resume via same user lock reacquire) | Yes |
| Responsive English UI (Tailwind, basic) | Yes |
| Mandatory documentation | Yes |

## Optional features included in this version
- Multiple users can edit the same document in realtime.
