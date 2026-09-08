# gymapp

A local-first gym & workout tracker. The app runs entirely in the browser
against IndexedDB (via Dexie) and works offline; an optional self-hosted server
provides multi-user accounts and cross-device sync backed by SQLite.

## Tech Stack
- **Frontend:** Vite + React + TypeScript, Tailwind CSS v4, React Router.
- **Local storage:** Dexie (IndexedDB), reactive via `useLiveQuery`.
- **Server:** Express (Node ESM) + SQLite (`sqlite3`).
- **Auth:** Username/password sessions (HttpOnly cookie) and optional OIDC.
- **Path alias:** `@/*` -> `src/*`, `@shared/*` -> `shared/*`.

## Project Layout
- `src/` — React app (pages, components, hooks, Dexie schema in `src/db/db.ts`).
- `server/` — Express API server (`server/index.js`) and pure helpers in
  `server/lib/` (password hashing, cookie parsing, column whitelist, OIDC).
- `shared/` — single source of truth for the sync schema (`syncSchema.js` +
  `syncSchema.d.ts`), imported by **both** the client and the server.
- `test/` — client-side tests (Dexie hydration via `fake-indexeddb`).

## Development
```bash
npm install
npm run dev        # Vite dev server (proxies /api to the backend)
```
The dev server proxies `/api` to `http://localhost:80` by default. Override the
backend target with `VITE_API_TARGET`. To run the API locally:
```bash
PORT=3000 DATA_DIR=./db node server/index.js
VITE_API_TARGET=http://localhost:3000 npm run dev
```

## Scripts
- `npm run dev` — start the Vite dev server.
- `npm run build` — type-check (`tsc -b`) and build the production bundle.
- `npm run preview` — preview the production build.
- `npm run lint` — run ESLint.
- `npm test` — run the Vitest suite once (`npm run test:watch` for watch mode).

## Tests
Vitest covers the security-critical paths:
- `server/lib/*.test.js` — password hashing/verification, cookie parsing,
  column whitelisting, OIDC token verification (against an in-memory JWKS).
- `server/sync.test.js` — HTTP integration test of `/api/sync` authorization
  and per-user scoping (composite `(userId, id)` keys, ownership checks).
- `server/adminUsers.test.js` — HTTP integration test of the `/api/admin/users`
  routes (list/create/promote/demote/password-reset/delete authz and guards).
- `test/hydrate.test.ts` — client snapshot hydration into IndexedDB.

New features ship with tests. Add or extend coverage alongside the code
(server routes → an HTTP integration test, helpers → a unit test, client logic
→ a `test/*.test.ts`) and keep `npm test` green.

```bash
npm test                                   # all tests
npx vitest run server/lib/crypto.test.js   # a single file
npx vitest run -t "rejects an expired token"   # by test name
```

## Deployment (Docker)
```bash
docker build -t gymapp .
docker run -p 8080:80 -v "$(pwd)/db:/app/data" gymapp
```
A `docker-compose.yml` is provided (configured for Traefik). The container
serves the built frontend and the API from the same Express process.

### Configuration (environment variables)
| Variable         | Default        | Description                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------ |
| `PORT`           | `80`           | Port the server listens on.                                        |
| `DATA_DIR`       | `/app/data`    | Directory for the SQLite database (`gymapp.db`).                   |
| `COOKIE_SECURE`  | `false`        | Set `true` when served over HTTPS so the session cookie is Secure. |
| `ADMIN_USERNAME` | _(unset)_      | Username promoted to admin on startup.                             |
| `PUBLIC_URL`     | _(auto)_       | Public base URL used to build the OIDC redirect URI.               |

The **first** account created via setup becomes the admin. OIDC is configured
from the in-app admin settings.

## Data & Sync Model
The client is the source of truth while offline: every mutation is written to
IndexedDB first, then pushed to `/api/sync`. Failed mutations are buffered in a
local outbox (`pendingSync`) and retried when connectivity returns. On login or
on a fresh device, the client pulls a full snapshot from `/api/sync/snapshot`
and replaces its local data.

Server-side, user-scoped tables use composite primary keys `(userId, id)` so
each device's IndexedDB auto-increment ids can be stored without colliding
across users. Every sync operation is scoped to the authenticated user.
