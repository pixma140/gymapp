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

## Next checkpoint

Start Phase B initial schemas and fixture mode. Replace transitional account
cleanup with foreign-key cascades when gyms become shared. The legacy client,
HTTP sync, and exercise implementation remain active. No fixtures, database
reset, or client model changes have been performed. Final checkpoint validation:
57 tests in seven files, lint, and build pass (existing bundle warning remains).
