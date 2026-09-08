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
