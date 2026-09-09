# Architecture

The rewrite described by the former PLAN.md is complete and its plan file was
removed: deterministic fixtures, account authorization, transactional bootstrap,
account-local tab coordination, durable revisioned synchronization, the
timed-workout UI, and gated publication all shipped in
`v0.2.0-alpha`. Verification runs locally and in GitHub Actions, including the
amd64/arm64 image build. `docs/implementation-baseline.md` keeps the historical
checkpoint log.

## Runtime and modules

The React/TypeScript/Tailwind app uses Dexie live queries. Express serves the
built frontend and APIs; Vite proxies API requests during development.

| Module | Responsibility |
| --- | --- |
| `server/index.js` | Configuration, database lease, initialization, listening, graceful close |
| `server/app.js` | App factory, auth/admin/OIDC routes, sync wiring, static serving |
| `server/db.js` | SQLite handle and serialized statements/transactions |
| `server/schema.js` | Fresh initial DDL, installation identity, revision/generation triggers |
| `server/config.js` | Validated environment configuration and explicit non-secret API projection |
| `server/seed.js` | Environment-supplied fixture accounts and stable shared gym UUIDs |
| `server/reset.js`, `databaseFiles.js` | Scoped reset and cooperating-process database lease |
| `server/services/accounts.js` | Account creation/OIDC identity resolution, role/deletion guards, atomic password reset |
| `server/services/sync.js` | Validated commands, revisions, receipts, consistent snapshots |
| `shared/commands.js`, `.d.ts` | Runtime command validation and protocol types |
| `src/context/SessionContext.tsx` | Bootstrap, ready-account handle, worker scheduling, logout/discard/conflict resolution |
| `src/db/db.ts` | Account/installation database factory and initial cache schema |
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

SQLite enables foreign keys. `users.id` is a server-generated UUID v7 primary key;
all account foreign keys are text. Recreating an account generates a new identity.
Shared `gyms`, private `workouts`, `workoutExercises`, and `userMeasurements` use UUID v7 primary keys.
The `uuid` package generates RFC 9562 v7 identifiers on both client and server,
including account, installation, and mutation IDs. Shared validators and initial SQLite
constraints enforce the version, variant, and canonical lowercase format.
Timestamp-prefixed IDs improve index locality; explicit timestamps and outbox
sequences still determine domain and delivery order across device clocks.
Account deletion cascades sessions, workouts, workout exercise uses, measurements, and mutation
receipts; it does not delete shared gyms. Referenced gyms cannot be deleted.
Archiving prevents new workouts but allows already-started sessions to finish.
A partial unique index enforces one unfinished workout per account.

Mutable synchronized records have revisions. Triggers advance account data
generation for profile/workout/measurement writes and catalog generation for
gym writes. Snapshot reads run within the same serialized transaction boundary
as mutations. Calls inside a transaction must use and await its scoped SQL
methods; calling the public queued methods from inside would deadlock.

Fresh-schema initialization and seeding are transactional. `installation`
records the UUID, catalog generation, and initial fixture/empty mode. A seed
completion marker is stored in `app_settings`. Ordinary startup cannot inject
fixtures into an initialized non-fixture database or recreate deleted fixtures.
During alpha, schema changes assume fresh databases and edit the initial
definitions directly; see the [alpha database policy](README.md#alpha-database-policy-and-reset).

IndexedDB names are `GymApp:<installation UUID>:<account ID>`. Initial version 1
stores contain profile (`users`), shared gym cache (`gyms`), private workouts and exercise uses,
measurements, ordered outbox, and sync metadata. Entity IDs are UUID v7 strings;
the outbox sequence is auto-incrementing. The outbox persists immutable intent,
an immutable prepared envelope once its server revision is known, dependency,
attempt count, state, error, and next retry time. Each prepared envelope carries
the account/installation binding checked by the server.

The read-only exercise catalog is generated into `shared/exercises.js` from a pinned
`exercises-dataset` revision. Runtime exercise selection is offline; only private
workout-to-catalog usage rows are persisted and synchronized. Licensed media is not imported.

## Commands and account lifecycle

Commands are profile update, measurement create/update/delete, timed workout
start/finish/delete, workout exercise create, and gym create/update/archive. Input allowlists exclude
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

## Behavior contract

These are the guarantees the test suites enforce. Treat a change that breaks a
row as a regression, not a preference.

| Scenario | Required result |
| --- | --- |
| Fresh reset with fixtures | Environment-supplied fixture accounts authenticate; administrator/regular roles are correct; exactly the two named gyms exist once. |
| Restart after fixture edits | No duplicate gyms, password resets, role repairs, or recreated deleted accounts. |
| Fixture mode disabled | Empty installation offers setup; concurrent first-admin setup is safe. |
| Admin versus user | Admin sees Users/OIDC/Gyms; user does not. Direct user calls to each admin endpoint fail without mutation. |
| Deployment configuration | Admin sees allowlisted non-secret settings; environment-set OIDC fields are read-only; credentials stay environment-only. |
| Shared catalog | Both accounts receive the same gym IDs/names. Admin rename appears for user after refresh. User cannot create/edit/archive gyms. |
| Private activity | A workout/measurement by one user is absent from the other's views, snapshot, and writes; gym visits are per user. |
| Account deletion | All private rows/sessions/receipts are removed atomically; shared gyms survive; self/last-admin alternate paths are blocked. |
| Offline edit and reload | Local state and queued command survive; eventual delivery occurs once. |
| Transaction failure | Neither a partial local operation nor an outgoing command survives rollback. |
| Switch/logout/session expiry | Previous account's queue is retained and paused; no cross-account delivery, including a second tab changing cookies. |
| Server reset with a cached browser session | Installation mismatch prevents replay into reset accounts. |
| Two devices, same account | New record IDs are distinct; competing active sessions or stale edits return conflicts; reviewed reapplication works. |
| Refresh with pending/failed work | No silent data replacement; failure and resolution are visible. |
| Exercise selection | The pinned catalog works offline; selections are private, synchronized, deduplicated per workout, and ranked by historical use. |
| Surviving UX | Start/resume/finish/cancel, history deletion, profile/measurements, language/theme, logout, and keyboard/mobile navigation work. |
| Release checks | Test, lint, build, browser workflows, and the multi-architecture image build pass; publishing is gated on them. |

## Remaining limits

OIDC protocol orchestration remains in app.js; identity creation and password
reset use the account service. No offline cold start, continuous pull, or
automatic merging is promised. Gym catalog operations share the sync service's
authorization, revisions, and receipt transaction rather than a separate gym
service. These are the final module placements.

Exercise catalog updates are explicit build-time imports through `npm run exercises:import`.
There is no runtime provider request or credential.

GitHub Actions runs only on release tags and manual dispatch: tests, lint, the
production build, and the Chromium workflows gate the amd64/arm64 image build
and its GHCR push, which is followed by GitHub release creation. Ordinary
commits run no pipeline, so local verification before tagging is the working
agreement. GitLab CI was removed; GitHub is the single release path.
