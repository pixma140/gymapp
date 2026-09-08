# Architecture

Current implementation checkpoint: Phases A–D, including deterministic fixtures,
account authorization, transactional bootstrap, and account-local tab coordination.
PLAN.md tracks remaining outbox, conflict-resolution, UI, and release hardening.

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
| `server/services/accounts.js` | Account creation/OIDC identity resolution, role/deletion guards, atomic password reset |
| `server/services/sync.js` | Validated commands, revisions, receipts, consistent snapshots |
| `shared/commands.js`, `.d.ts` | Runtime command validation and protocol types |
| `src/context/SessionContext.tsx` | Bootstrap, ready-account handle, worker scheduling, logout/discard |
| `src/db/db.ts` | Account/installation database factory and one-time legacy-cache cleanup |
| `src/db/operations.ts` | Atomic local state plus outgoing command |
| `src/db/sqliteSync.ts` | Ordered Web-Lock sender and receipt/dependency reconciliation |
| `src/db/hydrate.ts` | Validated snapshots, explicit empty/success/error preparation, pending-work preservation |
| `src/lib/api.ts` | Typed network/HTTP/malformed-response handling shared by auth, admin, bootstrap, and sync |
| `src/auth/tabs.ts` | Session locks, session-change notifications, and stale-sender epoch checks |

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

`GET /api/bootstrap` reads setup/session status, installation identity, current
capabilities, and an account-scoped snapshot in one SQLite transaction. The
provider validates the response before preparing a cache. Setup and route guards
consume provider state; errors show retry and never become an onboarding signal.
A valid account with no activity is an explicit empty hydration result.

Logout synchronously detaches the active handle, stops scheduling, waits for this
tab's tracked sender (including manual refresh), closes its handle, and invalidates
the server session. Caches/outboxes are retained. All senders take a shared
`gymapp-session` Web Lock followed by an exclusive `sync:<database name>` lock.
Bootstrap/cache preparation and password login/register/setup/logout take the
session lock exclusively, so cookie changes cannot overtake active senders.
BroadcastChannel announces changing/changed sessions; a shared localStorage epoch
also prevents sending before a delayed channel notification arrives. Returning
tabs check identity on visibility changes while preserving a ready cache offline;
OIDC return announces the changed cookie.
Browsers without Web Locks retain queues without sending.

Server-side envelope identity checks additionally protect against externally
changed cookies. Binding mismatch pauses the old queue and revalidates the
session. Dirty-cache generation mismatches are surfaced as conflicts; pending
intent is never silently replaced. Explicit refresh drains the tracked sender
and refuses snapshot replacement while pending work remains.

## Remaining limits

Retry backoff/Retry-After and reviewed conflict reapplication remain Phase E
work. OIDC protocol orchestration remains in app.js; identity creation and
password reset use the account service. Export/discard/reload is currently the
available conflict resolution. No offline cold start, continuous pull, or
automatic merging is promised. CI publishing gates and Docker build verification
remain Phase G work.
