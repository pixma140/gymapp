# Architecture

Current implementation checkpoint: Phase B schemas and deterministic fixtures,
with the client/API changes required to consume the new model. PLAN.md tracks
remaining authorization, lifecycle, conflict-resolution, and release hardening.

## Runtime and modules

The React/TypeScript/Tailwind app uses Dexie live queries. Express serves the
built frontend and APIs; Vite proxies API requests during development.

| Module | Responsibility |
| --- | --- |
| `server/index.js` | Configuration, database lease, initialization, listening, graceful close |
| `server/app.js` | App factory, auth/admin/OIDC routes, sync wiring, static serving |
| `server/db.js` | SQLite handle and serialized statements/transactions |
| `server/schema.js` | Fresh initial DDL, installation identity, revision/generation triggers |
| `server/seed.js` | Deterministic fixture accounts and shared gym UUIDs |
| `server/reset.js`, `databaseFiles.js` | Scoped reset and cooperating-process database lease |
| `server/services/accounts.js` | Atomic first setup, role changes, cascading deletion guards |
| `server/services/sync.js` | Validated commands, revisions, receipts, consistent snapshots |
| `shared/commands.js`, `.d.ts` | Runtime command validation and protocol types |
| `src/context/SessionContext.tsx` | Bootstrap, ready-account handle, worker scheduling, logout/discard |
| `src/db/db.ts` | Account/installation database factory and one-time legacy-cache cleanup |
| `src/db/operations.ts` | Atomic local state plus outgoing command |
| `src/db/sqliteSync.ts` | Ordered Web-Lock sender and receipt/dependency reconciliation |
| `src/db/hydrate.ts` | Identity-checked snapshot replacement that refuses pending work |

Providers are ordered session → language → theme. Domain routes mount only
with a ready account cache. Preference providers use that account's profile
and in-memory defaults before authentication. Admin and analysis routes are
lazy-loaded; body charts reside in the analysis chunk.

## Persistence

SQLite enables foreign keys. `users.id` uses AUTOINCREMENT to prevent reuse.
Shared `gyms`, private `workouts`, and `userMeasurements` use UUID primary keys.
Account deletion cascades sessions, workouts, measurements, and mutation
receipts; it does not delete shared gyms. Referenced gyms cannot be deleted.
Archiving prevents new workouts but allows already-started sessions to finish.
A partial unique index enforces one unfinished workout per account.

Mutable synchronized records have revisions. Triggers advance account data
generation for profile/workout/measurement writes and catalog generation for
gym writes. Snapshot reads run within the same serialized transaction boundary
as mutations. Calls inside a transaction must use and await its scoped SQL
methods; calling the public queued methods from inside would deadlock.

Fresh-schema initialization and seeding are transactional. `installation`
records the schema identifier, UUID, and initial fixture/empty mode. A seed
completion marker is stored in `app_settings`. Ordinary startup cannot inject
fixtures into an initialized non-fixture database or recreate deleted fixtures.
The old initial schema requires explicit reset; there are no ALTER migrations.

IndexedDB names are `GymApp:<installation UUID>:<account ID>`. Initial version 1
stores contain profile (`users`), shared catalog cache (`gyms`), private workouts,
measurements, ordered outbox, and sync metadata. IDs are UUIDs except the account
profile and auto-increment outbox sequence. Each outbox envelope additionally
carries the account/installation binding checked by the server.

There are no exercise, equipment, or set stores, seeds, routes, or provider calls.
`history.csv` is a standalone source export excluded from Docker input.

## Commands and account lifecycle

Commands are profile update, measurement create/update/delete, timed workout
start/finish/delete, and gym create/update/archive. Input allowlists exclude
account roles and credentials. Server revisions detect stale writes. Receipts
are stored atomically with successful mutations; a reused mutation UUID with
different content is rejected. Updates never resurrect deleted records.

Local operations update data and append intent in one Dexie transaction. Later
edits to the same record depend on earlier queued commands. An acknowledged
revision is persisted and passed to the next unsent dependent command; an
attempted command retains its original envelope for retry.

Logout detaches account screens, stops scheduling, waits for this tab's sender,
closes its database handle, and invalidates the server session. Caches/outboxes
are retained. BroadcastChannel notifies other tabs; server-side envelope
identity checks also protect against cookie changes between checks and sending.
Snapshot refresh refuses any pending queue. Dirty-cache generation mismatches
are surfaced as conflicts instead of silently replacing local data.

## Remaining limits

This checkpoint does not complete every Phase C–G requirement. Account creation,
password reset, and OIDC flows still have code in app.js; HTTP error handling is
not yet one shared typed client. Authorization-failure role refresh, exhaustive
multi-tab lifecycle tests, retry backoff/Retry-After, and reviewed conflict
reapplication remain. Export/discard/reload is currently the available conflict
resolution. No offline cold start, continuous pull, or automatic merging is
promised. CI publishing gates and Docker build verification remain Phase G work.
