# Implementation baseline — 2026-09-08

Initial working tree was clean. Baseline: 51 tests in six files passed;
`npm run lint` and `npm run build` passed. HTTP tests require local port binding
outside this environment's sandbox. Initial Vite output: JS 858.86 kB / gzip
252.54 kB; CSS 37.73 kB / gzip 6.86 kB. Vite reports the existing large-chunk warning.

## Domain inventory

- Account/profile writes: OnboardingPage, ProfilePage, SettingsPage,
  ThemeContext, LanguageContext. ProfilePage also writes measurements.
- Cache destruction/replacement: SetupPage, RequireAuth, SettingsPage,
  db/hydrate.ts. Providers/guards query the first global local user.
- Gym writes: AddGymForm and ManageGymsPage. GymList derives history display
  from workouts, while legacy schema still stores counters.
- Workout and set writes: useWorkoutSession; deletions in WorkoutDetailsPage
  and WorkoutHistoryList. WorkoutPage and EditWorkoutPage use this hook.
- Exercise writes/seeds: AddExerciseForm, ManageExercisesPage, db/db.ts.
- Sync writes: db/sqliteSync.ts installs global table hooks and separately
  queues failures; main.tsx initializes it. shared/syncSchema defines arbitrary
  table operations; server/app.js dispatches them and builds snapshots.
- Numeric domain route parsing: WorkoutPage (gymId), WorkoutDetailsPage and
  EditWorkoutPage (workoutId). Server admin account IDs remain numeric.
- Exercise consumers: ActiveExercise, AddExerciseForm, ExerciseList,
  ExerciseSelector, ProgressChart, ManageExercisesPage, WorkoutPage,
  EditWorkoutPage, WorkoutDetailsPage, WorkoutHistoryList, AnalysisPage,
  SettingsPage export/navigation, App routes, useWorkoutSession, db schema,
  hydration/sync contract, lib/utils display helpers, i18n/translations,
  server sync tests and test/hydrate.test.ts. Remove these dependencies together
  when replacing the contract. Source exports must remain untouched.
- Other database readers: RequireUser, useActiveWorkout,
  useMeasurementReminder, BodyProgressChart. All need account-local handles.

## Lifecycle seam

`createApp` accepts an initialized database and explicit configuration. Each
instance owns rate-limit and OIDC discovery caches. Importing app/db modules
creates no database. Startup remains in index.js. HTTP tests own temporary
files, HTTP listeners, and database close operations.

Every public SQL operation joins a per-connection queue. `transaction` holds
that queue slot across awaits and supplies scoped SQL methods; use these
methods inside its callback, never the public queued methods (which would
wait for the current transaction). Await all scoped statements before returning.
Close drains queued operations and rejects later work. Transactions reject
use of their scoped handle after completion.

## Account regression checkpoint

First-administrator creation now checks and inserts within one serialized
transaction. Role changes and administrator deletion recheck current authority,
self guards, and last-admin constraints inside the same transaction. Legacy
private rows and sessions are deleted atomically; profile sync cannot delete
accounts. The legacy table dispatcher rejects inherited property names.
HTTP regression coverage includes concurrent setup, both roles attempting
sync deletion, orphan cleanup, and rollback on a deliberately failed deletion.

`shared/commands.d.ts` declares the replacement command/snapshot protocol;
it does not activate a new HTTP contract. Account IDs stay integers, domain
IDs are UUID strings, profile targeting is bound to the account, and snapshots
carry account/catalog generations. Validators and durable command handling
must land with the schema/client switch.

## Phase B checkpoint

Fresh SQLite schema uses non-reused integer account IDs, UUID domain IDs,
foreign-key cascades, shared archived gyms, revisions, generations, and mutation
receipts. Initialization/seeding is one serialized transaction. Restart tests
verify edited passwords/roles/names and deleted users remain untouched. Reset
checks the cooperating-process lease and removes only configured database/WAL/
SHM files; fixture mode is explicit. The real `./db/gymapp.db` was checked for
open handles, reset, and seeded on 2026-09-08. No source export was deleted.

The schema switch required replacing the legacy HTTP mutation/snapshot contract
and updating its client consumers together. Account caches now use installation
and account identity, domain IDs are UUIDs, and local operations enqueue durable
intent transactionally. Exercise components/stores/seeds were removed; timed
screens use explicit start/resume/finish/cancel. Shared gym editing is protected
and uses archive operations. Theme/language read the ready account handle.

Additional tests cover fixture authentication, restart/reset, foreign keys,
account-ID non-reuse, generations, identity-bound commands, revision conflicts,
receipt replays, cache isolation, rollback, dependent edits, and one-time legacy
cache cleanup. Chromium smoke coverage uses an isolated temporary server/database. Final validation: 58 Vitest tests and two Chromium smoke workflows pass; lint and build pass. Initial JS is approximately 446.6 kB / gzip 137.9 kB (baseline 858.86 / 252.54). Admin and analysis/chart code build as separate chunks.

## Next checkpoint

Finish remaining Phase C account-service consolidation and role refresh on
forbidden responses. Then finish Phase D shared API/error handling and exhaustive
multi-tab lifecycle testing; Phase E backoff/Retry-After and reviewed conflict
reapplication remain. Dirty-cache generation checks currently run at bootstrap;
extend this to reconnect delivery. Export/discard/reload is the current conflict
resolution. Do not mark these requirements complete merely because the initial
worker/snapshot plumbing exists. Phase G CI publication gates and Docker image
verification remain, as does the future external exercise integration.

## Phase C checkpoint — 2026-09-08

- Setup and password-account creation share one insert operation. Registration
  checks initialization and case-insensitive uniqueness transactionally and cannot
  grant administrator status. Admin creation, role changes, deletion, and password
  reset check the actor's current role inside their serialized transaction.
- Password changes and session invalidation commit or roll back together.
  Verified OIDC identities resolve/create transactionally; login no longer calls
  the startup administrator bootstrap. Token signature/issuer/audience/nonce
  verification remains unchanged.
- Admin API and outbox 401/403 responses notify SessionProvider to quiesce its
  sender and refresh session/role state. Pending intent survives this refresh;
  forbidden commands retain their actionable failed state.
- Regression coverage includes competing registrations, direct access to every
  admin endpoint after demotion, service authorization, password-reset rollback,
  concurrent OIDC identity resolution, and browser removal of stale admin access.
- Validation: 63 Vitest tests in seven files, lint, build, and all three Playwright
  workflows passed. HTTP/browser tests ran outside the sandbox for local port
  binding. Initial JS: 446.79 kB / gzip 137.94 kB; admin and analysis remain separate
  chunks. Phase D/E's broader request classification and conflict work remain open.

## Phase D server checkpoint — 2026-09-08

Added a no-store `GET /api/bootstrap` response with setup/signed-out/authenticated
states. Authenticated responses include installation identity, current session
user/capabilities, and a private snapshot. Session resolution and snapshot reads
share one serialized transaction, using the same snapshot reader as explicit
refresh. Added HTTP coverage in `server/sync.test.js` for setup, absent/expired
sessions, role capabilities, and account/installation binding. The full Vitest
suite passed (80 tests including the in-progress client regressions).

## Phase D client checkpoint — 2026-09-08

- SessionProvider consumes the validated transactional bootstrap. Setup/guards
  use provider state; only a ready account mounts domain screens and runs its
  tracked sender. Manual refresh uses the same sender as scheduled delivery.
- Auth, admin, bootstrap, and sync share typed request/error handling. Network,
  unauthenticated, forbidden, validation, conflict, malformed, server, and
  rate-limit failures remain distinct. Failed logout does not claim success.
- Cache preparation reports success, valid empty activity, or error. It validates
  profile/catalog/private records and bindings before writing, retains dirty
  caches, and never interprets a failed load as onboarding.
- Web Locks serialize senders per account and exclude cookie changes/bootstrap
  from active sends. Channel notifications and an epoch changed under the lock
  invalidate stale work; login/logout propagates between tabs. Identity checks
  when a tab becomes visible preserve ready offline data on network failure.
- Added `test/api.test.ts` and extended HTTP, fake-IndexedDB, and browser tests
  for response classification, bootstrap binding, rejected/paused intent,
  stale lock waiters, failed reload/retry, offline tab return, single-sender
  exclusion, and queue retention through logout/account switching.
- Final validation: 86 Vitest tests in eight files, lint, production build, and
  all five Playwright workflows passed. Tests requiring local ports/browser
  processes ran outside the sandbox. Initial JS: 451.86 kB / gzip 139.31 kB;
  admin and analysis remain separate chunks.
- Phase E remains open for backoff/Retry-After, immutable-envelope refinements,
  freezing local writes during snapshot replacement, and reviewed conflict
  reapplication. No application database reset or schema migration was needed.
