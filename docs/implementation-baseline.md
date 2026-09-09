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

## Phase E checkpoint — 2026-09-08

- Outbox rows now separate immutable local intent from the immutable command
  envelope prepared when its real expected server revision is known. Sequence,
  dependency, attempts, state, error, and retry deadline persist in IndexedDB.
- The ordered Web-Lock worker performs generation preflight before first delivery,
  retains ambiguous envelopes unchanged, exponentially backs off network/5xx
  responses, honors 429 `Retry-After`, pauses 401/binding failures, and leaves
  validation, permission, and revision failures actionable at the queue head.
- Snapshot replacement detaches account UI and commits domain tables, outbox, and
  generation metadata atomically. Conflict actions either discard the rejected
  dependency chain or replay reviewed intent over the authoritative snapshot with
  new mutation IDs. Settings export remains available before destructive action.
- Sync UI reports translated pending, paused, failed, conflict, and last-refresh
  state. Final validation: 107 Vitest tests in nine files, lint, production build,
  and all eight Chromium workflows pass.

## Phase F checkpoint — 2026-09-08

- Profile and onboarding saves now use one domain operation that atomically writes
  the profile update, optional measurement row, and both durable intents. Focused
  fake-IndexedDB tests prove successful measurement history and full rollback when
  the measurement command is invalid.
- Gym selection, workout resume, reminder, settings-back, and bottom navigation
  use native React Router links. Mutation controls remain native buttons; the old
  paired pointer/click workaround is absent. Profile fields and history icon
  controls have accessible labels.
- Mobile Chromium coverage uses touch to open a gym, keyboard activation to move
  between bottom-navigation links, and verifies a saved measurement appears in
  the surviving body-analysis view. Scroll reset and safe-area layout remain.
- Final validation: 111 Vitest tests in nine files, lint, production build, and all
  eight Chromium workflows pass. Initial JS is 461.83 kB / gzip 141.62 kB; admin
  and analysis remain separate chunks.

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

## Phase G regression checkpoint — 2026-09-09

- Extended HTTP coverage for catalog rename visibility on the next user snapshot
  and administrator denial when deleting another account's measurement. Fixed
  the concurrent-start receipt test to mutate the actual winning payload, so its
  result no longer depends on request ordering.
- Added fake-IndexedDB coverage proving a persisted offline edit delivers exactly
  once after cache reopening and commits the acknowledged revision.
- ESLint now checks server/shared JavaScript and the browser server harness with
  Node globals; generated browser reports are excluded. No formatting sweep or
  application behavior change was required.
- All 113 Vitest tests in nine files and the expanded lint check pass.

Acceptance coverage remains in the existing suites: seed tests cover fresh,
restart, non-fixture, and reset behavior; admin/sync HTTP tests cover roles,
shared/private data, deletion, revision conflicts, and receipts; hydrate/API/reset
integration tests cover rollback, persisted queues, account/installation binding,
refresh and conflict resolution; browser workflows cover timed sessions,
measurements, preferences, navigation, and multi-tab lifecycle. No new test file
was introduced.
