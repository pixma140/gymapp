# Architecture

Current implementation checkpoint: Phases A–G are implemented, including
deterministic fixtures, account authorization, transactional bootstrap,
account-local tab coordination, durable revisioned synchronization, timed-workout
UI, and CI publication gates. Local checks pass; hosted verification and the
arm64 image build run in GitHub Actions.

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
| `src/context/SessionContext.tsx` | Bootstrap, ready-account handle, worker scheduling, logout/discard/conflict resolution |
| `src/db/db.ts` | Account/installation database factory and one-time legacy-cache cleanup |
| `src/db/operations.ts` | Atomic local state plus outgoing command |
| `src/db/sqliteSync.ts` | Ordered Web-Lock sender, generation preflight, retry timing, and receipt/dependency reconciliation |
| `src/db/hydrate.ts` | Validated atomic snapshots, pending-work preservation, and explicit conflict resolution |
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
profile and auto-increment outbox sequence. The outbox persists immutable intent,
an immutable prepared envelope once its server revision is known, dependency,
attempt count, state, error, and next retry time. Each prepared envelope carries
the account/installation binding checked by the server.

There are no exercise, equipment, or set stores, seeds, routes, or provider calls.
`history.csv` is a standalone source export excluded from Docker input.

## Commands and account lifecycle

Commands are profile update, measurement create/update/delete, timed workout
start/finish/delete, and gym create/update/archive. Input allowlists exclude
account roles and credentials. Server revisions detect stale writes. Receipts
are stored atomically with successful mutations; a reused mutation UUID with
different content is rejected. Updates never resurrect deleted records.

Local operations update data and append intent in one Dexie transaction. Later
edits to the same record depend on earlier queued commands and remain unprepared
until the earlier acknowledgement supplies the real server revision. An
attempted command retains its original envelope for retry. Network/5xx failures
use persisted exponential backoff, 429 honors `Retry-After`, and terminal errors
remain at the head of the ordered queue for explicit action.

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
session. Before first delivery, a dirty queue compares its recorded private or
catalog generation with a consistent server snapshot; mismatches become explicit
conflicts. Snapshot replacement detaches domain UI and swaps all domain tables
and generation metadata in one Dexie transaction. Conflict actions either drop
the rejected dependency chain or atomically load current server data and reapply
reviewed intent with new mutation IDs. Pending intent is never silently replaced.
Explicit refresh drains the tracked sender and refuses replacement while pending
work remains.

## Remaining limits

OIDC protocol orchestration remains in app.js; identity creation and password
reset use the account service. No offline cold start, continuous pull, or
automatic merging is promised. Gym catalog operations share the sync service's
authorization, revisions, and receipt transaction rather than a separate gym
service. These are the final module placements from the proposed plan.

GitHub Actions runs tests, lint, the production build, and Chromium workflows
before any image work. Branch and pull-request runs build amd64/arm64 images
without publishing; only release tags publish to GHCR, and only after
verification passes. GitLab CI was removed; GitHub is the single release path.
