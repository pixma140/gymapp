# Implementation plan

Status: Phase E is implemented and verified. Durable intent and immutable prepared envelopes, ordered retry/backoff, generation preflight, failure-atomic snapshot replacement, explicit discard/reapply conflict resolution, and translated sync state are complete. Resume with the unchecked Phase F surviving profile/measurement and native-activation work or Phase G verification/CI tasks. The development database was last explicitly reset and seeded during Phase B on 2026-09-08; Phases D.5 and E required no development reset. See `docs/implementation-baseline.md` for checkpoint details.

Sources: [SUGGESTIONS.md](SUGGESTIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the user's appendix. The appendix takes precedence: this is a work-in-progress reset, default test users and shared gyms are required, and the existing exercise implementation must be removed. External exercise integration belongs to a later task.

## 1. Target behavior and settled decisions

### Development fixtures

| Username | Password | Role | Expected access |
| --- | --- | --- | --- |
| `admin` | `123geheim` | Administrator | Training, profile, analysis, settings, shared-gym management, users, and OIDC administration. |
| `user` | `123geheim` | Regular user | Training, own profile/history/measurements, and personal settings. No administrator UI or API access. |

Create two shared gyms, once each, with stable UUIDs:

- **Iron Odyssey** — location: **Foundry District**.
- **Moonshot Barbell Club** — location: **Riverside Hangar**.

Both accounts receive the same gym records and IDs. Gyms form an application-wide catalog, not two separately seeded personal copies. Administrators manage this catalog; regular users can browse/select gyms. This is the chosen interpretation of shared gyms and replaces existing personal-gym CRUD. Workouts, visit counts, profiles, measurements, and sync queues remain private to each account; administrator status does not grant general access to another user's workout history.

Use an explicit `SEED_DEV_DATA=true` startup mode, enabled in the documented development command and the current development Compose configuration. The seed function runs transactionally and only initializes a fresh installation. Restarting preserves edited passwords, role changes, renamed gyms, and deliberately deleted accounts; it must not recreate or overwrite them. Store a seed completion marker and refuse to silently inject fixtures into an already initialized non-fixture installation. Provide an explicit reset-and-seed command for returning to the exact baseline.

Hash fixture passwords using the existing password helper. Seed complete minimal profiles so both accounts can log in and immediately see the gyms. No workouts, measurements, exercises, or equipment are seeded. When fixture mode is disabled, preserve the first-administrator setup flow, registration, and optional OIDC. Automated tests choose fixture or empty-setup mode explicitly.

### Exercise removal and interim product scope

Remove the entire current exercise catalog implementation, not just its seed rows:

- Remove `Exercise`, `GymEquipment`, and `WorkoutSet` from the initial local/server schemas, synchronization contract, snapshots, exports, and tests that depend on the removed model.
- Remove `ActiveExercise`, `AddExerciseForm`, `ExerciseList`, `ExerciseSelector`, `ProgressChart`, `ManageExercisesPage`, their imports/routes/navigation, and exercise-specific translation/display helpers and dictionary entries.
- Remove the exercise extraction script and extracted catalog text. Do not import `history.csv`; preserve that standalone source export outside app initialization and exclude it from the Docker build context. The request to wipe databases does not require deleting a user's unrelated source export.
- Remove set editing and exercise statistics from workout screens/history. Retire the existing exercise-based workout edit page and its links; redirect its old URL to workout details.
- Keep timed workout start/resume/finish/cancel, workout details/deletion, gym selection, body measurements, and body-progress charts. Show a concise translated notice that exercise logging is not available yet; provide no dummy exercises or nonfunctional Add Exercise buttons.
- Do not introduce external-provider credentials, requests, imported data, placeholder exercise tables, or speculative provider adapters. The future provider's identity/licensing/schema requirements will be decided in the next task.

The old exercise translation/editing recommendation and default exercise seeding recommendation are therefore superseded, not unfinished work in this update.

### Persistence and supported consistency

- Keep React, TypeScript, Tailwind, Dexie, Express, SQLite, and the existing test stack.
- Retain server integer account IDs, with non-reuse enforced in the fresh schema; use UUID strings for gyms, workouts, and measurements. Replace numeric route parsing for domain IDs.
- Keep domain writes durable offline once an account cache is ready. A new browser session still requires server authentication; do not claim offline cold-start support or add a service worker in this update.
- Use account-specific IndexedDB databases plus an installation identity supplied by the server. A deliberate server reset creates a new installation identity, preventing an old queue from being replayed against newly seeded account IDs.
- Support explicit refresh and conflict detection. Do not promise continuous background pull, automatic conflict merging, or real-time collaboration.
- No upgrade migration is required. Rewrite initial SQLite tables and Dexie `version(1)` for a fresh database, as authorized. Do not add `ALTER TABLE` or a new Dexie version.

## 2. Minimal module boundaries

The following paths are proposed implementation targets, not existing files:

| Module | Responsibility |
| --- | --- |
| `server/index.js` | Process startup, configuration, database initialization, optional fixture seeding, and listening. |
| `server/app.js` | `createApp(...)`, dependency wiring, API routers, static assets, error handling. No import-time database creation. |
| `server/db.js` | SQLite connection, initial schema, explicit transaction/write serialization, close/reset helpers. |
| `server/services/accounts.js` | Setup, sessions, account creation, role changes, password reset, complete account deletion. |
| `server/services/oidc.js` | Existing discovery/state/token flow, using existing verification helpers. |
| `server/services/sync.js` | Validated account-bound commands, deduplication, revision checks, consistent snapshots. |
| `server/services/gyms.js` | Shared catalog reads and administrator-only changes. |
| `shared/` | Narrow runtime validators, command names, payload declarations, and snapshot contract. |
| `src/context/SessionContext.tsx` | One bootstrap/account/cache lifecycle coordinator and role state. |
| `src/db/` | Account database factory, write operations, outbox worker, snapshot refresh. |
| `src/auth/` or `src/lib/api.ts` | Shared typed request/error handling; existing auth/admin wrappers delegate to it. |

Use small operation functions instead of a generic repository per table. Keep simple live queries near their consumers. Supply the current database through context; theme and language providers must stop reading a process-global database or the first arbitrary local user. Use fallback preferences before authentication.

## 3. Implementation phases

Each phase should be a reviewable change with relevant tests. Existing uncommitted files are the starting implementation: preserve them and do not reset the working tree to HEAD.

### Commit requirements

- Create Git commits for completed implementation work as it progresses; do not leave the entire update as one uncommitted change.
- Commit each coherent, verified change, splitting large phases into smaller commits. Include its implementation, relevant tests, and documentation together.
- Run the checks appropriate to the change before committing, inspect the staged diff, and use a descriptive commit message explaining the resulting behavior.
- Stage files or hunks deliberately. Do not sweep unrelated pre-existing changes or source exports into a commit; include existing work only when it belongs to the change being completed.
- Update this plan's checkboxes with completed work and include those updates in the corresponding commits. Do not mark unverified work complete.
- Finish with all work performed for this plan committed, and report the commit hashes and validation results. Any remaining unrelated working-tree changes should be identified separately.
- These instructions authorize local commits during implementation; publishing, pushing, and merging are separate actions.

### Phase A — Establish the new contract and test seams

- [x] Record the current passing test/build/lint baseline and inventory all domain writes, route ID parsing, table consumers, and exercise references.
- [x] Extract `createApp` and database lifecycle without changing existing behavior first. Adapt HTTP tests to inject and close temporary databases explicitly.
- [x] Add a serialized transaction helper: asynchronous statements inside one transaction must not interleave with another request's writes on the shared SQLite connection.
- [x] Define explicit command and snapshot types for profiles, measurements, timed workouts, and shared gyms (`shared/commands.d.ts`).
- [x] Remove arbitrary table mutation as the public write contract when switching implementations (phases B–E).
- [x] Add focused regression coverage for alternate account deletion, orphan cleanup, and concurrent setup. Tests for the replacement contract can land with the corresponding implementation; do not retain old exercise behavior as a compatibility requirement.

**Exit:** test resources are isolated and the replacement contract is concrete enough for the schema/client work below.

### Phase B — Replace initial schemas and implement deterministic reset/seeding

- [x] Define accounts, sessions, OIDC state/settings, installation identity, global gyms, private workouts/measurements, revisions, and mutation receipts in initial SQLite DDL.
- [x] Use foreign keys with enforcement enabled. Account deletion cascades private data, sessions, and mutation receipts. Workouts reference shared gyms; account deletion never deletes shared gyms.
- [x] Remove persisted gym visit counters. Derive visits/last visit from the active user's completed workouts.
- [x] Add a revision to mutable synchronized records and an account data-generation counter. Every private mutation increments its account generation; shared catalog changes increment a catalog generation.
- [x] Create account-local Dexie `version(1)` stores for profile, shared gym cache, workouts, measurements, outbox, and sync metadata. Domain keys are UUIDs, local outbox order uses an auto-increment sequence, and all records bind to the account/installation cache.
- [x] Implement the fixture mode and one-time marker described above. Check exact roles and names in seed tests, and run normal password authentication to verify both credentials.
- [x] Add a scoped reset command that closes connections and recreates only this app's configured database, including its WAL/SHM companions. Stop the running server first. Reset generates a new installation identity and reseeds only when requested.
- [x] During this authorized WIP reset, clear the known legacy `GymAppDB` cache once and document the reset. Do not delete unrelated browser storage or repeat a destructive reset on ordinary startup.

**Exit:** reset-and-seed produces exactly two accounts, two shared gyms, and zero workout/exercise data; a restart leaves existing application data unchanged.

### Phase C — Enforce account and shared-gym authorization

- [x] Move account creation/deletion and role changes into shared service operations. Remove account deletion and role/credential changes from profile sync.
- [x] Keep self-deletion/self-demotion prohibited in this iteration. Check the last-admin invariant and cleanup inside the same serialized transaction. Keep regular registration non-admin and first-admin setup atomic.
- [x] Preserve password-reset session invalidation and OIDC verification behavior. Refresh role state on authorization failure; always enforce current roles server-side.
- [x] Expose catalog reads to authenticated users; expose create/edit/archive operations only to administrators. Archive gyms instead of deleting referenced records, preserving history. Prevent new workouts at archived gyms while allowing existing sessions to finish.
- [x] Move shared-gym management into the protected admin experience. Remove ordinary-user Add Gym controls and redirect/guard the old settings management route consistently.
- [x] Validate object shapes, UUIDs, finite measurements/timestamps, allowed command names, required fields, ownership, and revisions. Unknown/inherited property names must never select a handler. Reject removed exercise commands explicitly.
- [x] Bound the domain rules: nonempty names, positive weight/height when supplied, body-fat percentage in range, valid reminder/theme/language values, and workout end time not before start time. Enforce at most one unfinished workout per account, with a deliberate conflict outcome for concurrent device starts.

**Exit:** `user` cannot access or mutate any admin operation through direct HTTP calls; both accounts read identical gym IDs, and their private histories remain isolated.

### Phase D — Centralize bootstrap and account-local state

- [x] Replace independent session requests in guards/pages with one provider state model: loading, setup required, signed out, preparing cache, ready, and failed. Only mount domain screens and start the worker when ready.
- [x] Have bootstrap return installation/account identity and capabilities. A ready account uses its own database handle; guards consume provider state rather than fetching again.
- [x] Consolidate request handling and distinguish network failure, unauthenticated, forbidden, validation, conflict, and malformed response. Hydration returns distinct success/empty/error results; failure never silently triggers onboarding.
- [x] On logout/switch, stop worker scheduling, quiesce in-flight work, detach account UI/queries, invalidate the session, and retain that account's queue/cache. Late callbacks must not mutate the next account's state.
- [x] Bind outgoing commands to both expected account ID and installation identity; the server compares these with the current session/installation and rejects mismatches. This protects against a cookie changed by another tab between client checks and delivery.
- [x] Coordinate tabs so a given account has one active sender, using a tested browser lock strategy. Propagate login/logout changes; a stale tab must pause rather than submit under a new cookie.
- [x] Let the initial session bootstrap hydrate empty caches. Existing caches with pending work must not be wiped. Provide a separately confirmed local-discard/reset action that explains pending-work loss.

**Exit:** queued edits for A cannot be sent as B, erased by B's login, or replayed after a server reset. Failed bootstrap offers retry and preserves local data.

### Phase D.5 — Close audited A-D gaps before Phase E

The 2026-09-08 repository audit re-ran all Vitest tests, lint, and the production build successfully (86 tests in eight files). Phase A had no implementation gap. The remediation below was subsequently verified with 95 Vitest tests in nine files, lint, a production build, and eight browser workflows.

- [x] Make discard/reload failure-atomic. Fetch and validate an authoritative snapshot before deleting pending intent, then clear the outbox and replace the current account's domain tables and generation metadata in one Dexie transaction. A network, server, or malformed-response failure must leave both optimistic rows and commands untouched. Keep the action account-scoped and label it consistently as pending-change discard rather than an application-wide reset.
- [x] Enforce strict request shapes and primitive types on setup, registration/login where applicable, administrator user creation/password/role changes, and OIDC settings. Reject arrays, unexpected properties, non-boolean `isAdmin`/`enabled` values, and unsupported setup languages instead of coercing them. Add direct HTTP regression tests proving malformed payloads cannot create an administrator or enable OIDC accidentally.
- [x] Complete the deterministic fixture/reset proof: assert the exact `Administrator` and `User` profile names through normal authentication, and test reset-and-seed as one operation for exact accounts/roles, stable shared gyms, zero private activity, absent exercise tables, and preservation of unrelated files. Exercise configured WAL/SHM cleanup explicitly.
- [x] Add a genuinely concurrent two-device workout-start test. Send two distinct valid commands simultaneously and prove exactly one succeeds, one returns the deliberate `active_workout_exists` conflict, and only one unfinished row exists without leaking a SQLite error.
- [x] Add lifecycle tests for logout/account switch during an in-flight send, superseded bootstrap/refresh completion, and acknowledgement after detachment. Prove stale callbacks cannot publish or mutate the next account's state while confirmed acknowledgements leave the old account cache consistent.
- [x] Add an end-to-end server-reset replay test: queue a command under installation X, reset to installation Y, and prove the stale command is rejected and retained/paused, creates no Y data, and the Y bootstrap opens a separate clean cache.
- [x] Add a browser test for a cookie/account change outside the initiating tab's normal notification path. Prove the stale visible tab cannot mutate the new account, pauses and revalidates on binding mismatch, and preserves the original account's queue.
- [x] Add discard UX/regression coverage for cancel, successful authoritative replacement, failed snapshot retrieval, export-before-discard, and account scoping. Verify another account's cache is never cleared.

**Exit:** the A-D implementation claims are backed by direct regression coverage; malformed privileged requests are rejected without coercion; discard cannot orphan optimistic state or lose intent on refresh failure; concurrent starts resolve deterministically; and account/installation changes cannot publish stale state or replay old commands.

### Phase E — Implement durable commands, revisions, and refresh

- [x] Remove network-producing Dexie table hooks and `setupSQLiteSync(db)` from `main.tsx`. Every surviving domain write goes through an operation that atomically stores the local change and command in Dexie.
- [x] Use immutable command envelopes containing mutation UUID, expected account/installation, operation, target UUID, payload, and expected server revision. Store sequence, dependencies, attempts, and failure state locally.
- [x] For multiple offline edits to one record, sequence dependent commands. After an acknowledgement, persist the returned revision before preparing the next unsent command; do not invent server revisions. A command that may already have reached the server must retain its original ID/payload on retry.
- [x] Run one ordered worker after bootstrap. Network/5xx retain and back off; 401 pauses for login; 429 honors retry timing; validation/permission/conflict failures remain actionable. Stop at blocked work initially for simple deterministic ordering.
- [x] On the server, authenticate and validate before dispatch. Check revision and operation-specific permissions, commit the command plus receipt in one transaction, and return the resulting revision. Retried mutation IDs return the stored result; reuse with a different payload is rejected.
- [x] Treat repeated deletes with the same mutation ID as successful receipt replays. An unknown deleted record cannot be resurrected by an update. With full snapshots, absent rows convey deletions; no incremental tombstone feed is required in this iteration.
- [x] Implement explicit Refresh: first drain pending work; if failed/conflicted work remains, block destructive replacement and expose resolution. Return full account data plus the shared gym catalog in a consistent read transaction.
- [x] Freeze local domain writes briefly during snapshot replacement and swap tables atomically with recorded generation metadata. If the server account generation differs before replaying a dirty offline queue, require conflict/rebase handling instead of blindly sending stale commands.
- [x] Provide clear conflict actions: discard the rejected local change and dependent commands then reload, or reapply the user's reviewed intent against the latest revision with a new mutation ID. Never silently merge or overwrite. Preserve/export pending intent before discard when requested.
- [x] Show translated pending, paused, failed, conflict, and last-refreshed state. Shared gym admin edits use the same revision/deduplication principles, with server-side role checks and an explicit refresh for other clients.

**Exit:** committed local work survives reload; rollback sends nothing; ambiguous retries are idempotent; two devices' UUIDs do not collide; stale updates are detected; refresh never silently destroys pending work.

### Phase F — Remove exercises and simplify the surviving screens

- [x] Delete the exercise components/page/chart listed in section 1 and the corresponding models, seed callback, sync branches, exports, test fixtures, extraction artifacts, and translations.
- [x] Simplify `useWorkoutSession` to timed session lifecycle only. Use string UUID route params throughout training, active-workout lookup, details, and history.
- [x] Remove automatic session creation on mere page render if it can duplicate sessions; create through an explicit Start Workout action with idempotent operation semantics. Resume an existing active session instead of silently starting another.
- [x] Rewrite workout details/history around gym, start/end, duration, and deletion. Remove set counts, volume, exercise selection, and set-edit routes/links. Keep the old edit URL redirect only as navigation compatibility, not old storage compatibility.
- [ ] Preserve profile and measurement forms using transactional operations, measurement history, and body-progress analysis. Remove the exercise-progress analysis tab.
- [x] Keep cancellation on-screen with translated error feedback when it fails. Ensure cancel/delete cannot trigger automatic recreation.
- [ ] Use native links/buttons and one activation path; verify the old touch-navigation issue rather than retaining paired pointer/click workarounds. Keep scroll reset, safe areas, and keyboard-accessible labels.
- [x] Hide the empty General admin tab, lazy-load surviving admin/analysis screens, and remove dead imports/helpers/styles without a broad visual redesign.

**Exit:** both users can select shared gyms and run timed sessions; exercise routes/components/tables are gone; no request reaches an external exercise provider.

### Phase G — Verification, CI, and documentation

- [ ] Extend existing Vitest HTTP and fake-IndexedDB tests for the matrix below. Replace old schema/exercise fixtures; preserve relevant password/OIDC/authz tests.
- [x] Add browser smoke coverage for the surviving workflows. Keep the setup small; choose a browser runner in implementation only if the available environment has no reusable harness. Wire its install/run commands explicitly if introduced.
- [ ] Extend ESLint to server/shared JavaScript with appropriate globals. Keep formatting/line-ending normalization isolated from behavior changes.
- [x] Run `npm test`, `npm run lint`, and `npm run build`; fix failures. Measure the resulting initial bundle and verify charts/admin code actually load separately.
- [ ] Update GitLab workflow rules so verification runs for branches/merge requests as well as release tags. Make multi-architecture image publication depend on passing checks, while retaining tag-only publishing.
- [x] Update Docker/Compose and README with the fixture flag, reset command, exact test logins, shared-gym permissions, offline/refresh limitations, and the temporary absence of exercise logging. Keep non-fixture setup documented.
- [x] Update `ARCHITECTURE.md`, stale `AGENTS.md` assumptions, new test-file listings, and the suggestions disposition. Do not mark the future external exercise integration complete.

## 4. Required acceptance matrix

| Scenario | Required result |
| --- | --- |
| Fresh reset with fixtures | Exactly `admin` and `user` authenticate with `123geheim`; roles are correct; exactly the two named gyms exist once. |
| Restart after fixture edits | No duplicate gyms, password resets, role repairs, or recreated deleted accounts. |
| Fixture mode disabled | Empty installation offers setup; concurrent first-admin setup is safe. |
| Admin versus user | Admin sees Users/OIDC/Gyms; user does not. Direct user calls to each admin endpoint fail without mutation. |
| Shared catalog | Both accounts receive the same gym IDs/names. Admin rename appears for user after refresh. User cannot create/edit/archive gyms. |
| Private activity | A workout/measurement by one user is absent from the other's views, snapshot, and writes; gym visits are per user. |
| Account deletion | All private rows/sessions/receipts are removed atomically; shared gyms survive; self/last-admin alternate paths are blocked. |
| Offline edit and reload | Local state and queued command survive; eventual delivery occurs once. |
| Transaction failure | Neither a partial local operation nor an outgoing command survives rollback. |
| Switch/logout/session expiry | Previous account's queue is retained and paused; no cross-account delivery, including a second tab changing cookies. |
| Server reset with an old browser | Installation mismatch prevents replay into reset accounts; legacy cache handling is explicit. |
| Two devices, same account | New record IDs are distinct; competing active sessions or stale edits return conflicts; reviewed reapplication works. |
| Refresh with pending/failed work | No silent data replacement; failure and resolution are visible. |
| Exercise removal | No exercise/equipment/set stores, routes, controls, seeds, or provider network calls remain. Source export is not imported. |
| Surviving UX | Start/resume/finish/cancel, history deletion, profile/measurements, language/theme, logout, and keyboard/mobile navigation work. |
| Release checks | Test, lint, build, browser smoke checks, and image build pass; publishing is gated. |

## 5. Coverage of SUGGESTIONS.md

| Suggestion | Plan disposition |
| --- | --- |
| 1. Account/sync lifecycle | Phases D–E; account caches, installation identity, multi-tab coordination. |
| 2. Durable outbox | Phase E; transactional commands, ordered retries, receipts, visible failures. |
| 3. Account deletion | Phases B–C; one policy and atomic cleanup. |
| 4. Multi-device model | Phases B/E; UUIDs, revisions/generations, explicit refresh/conflict handling. |
| 5. Validation/relationships | Phases B–C/E, adapted to shared gyms and removed exercise entities. |
| 6. Fresh initialization | Phase B; authorized wipe and deterministic users/gyms. Exercise seeding is superseded. |
| 7. Session/error handling | Phase D. |
| 8. Cohesive modules | Phases A/D/E and the minimal module map. |
| 9. Exercise translation identity | Superseded by complete exercise removal; decide future identity with the external database later. |
| 10. Failure/touch handling | Phase F. |
| 11. Redundant state/bundle/UI | Phases B/F; derived visits, lazy routes, no empty admin tab. |
| 12. Tests/CI/docs | Phase G. |

Completion means all applicable checkboxes and acceptance cases pass for this reduced exercise-free app. It does not mean external exercise integration is implemented, migrations for old installations exist, or continuous synchronization is supported.
