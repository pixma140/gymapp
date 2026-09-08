> Implementation checkpoint (2026-09-08): Phase B schemas/fixtures and the necessary command/cache/timed-screen switch are implemented. Exercise catalog and translation recommendations are superseded by exercise removal. Remaining recommendations and verification are tracked in [PLAN.md](PLAN.md); external exercise integration is still a future task.

# Architecture and code-quality suggestions

Assessment date: 2026-09-08. Scope: the current working tree, including uncommitted and untracked application files. This is a source-based engineering assessment of a small self-hosted workout tracker, not a complete security audit or a browser usability evaluation. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system description.

## Rating

| Area | Score | Reason |
| --- | --- | --- |
| Architecture | **6/10** | The React/Dexie/Express/SQLite stack fits the product, but synchronization and account lifecycle rules are distributed across modules without strong consistency guarantees. |
| Code quality | **6/10** | Most code is readable and follows familiar patterns. Strict client TypeScript and meaningful tests help. Silent failures, duplicated session logic, incomplete runtime validation, and uneven test coverage reduce confidence. |
| Overall | **6/10** | A credible alpha foundation. Reliable offline and multi-device use needs more work before adding much more product scope. |

On this scale, 5 means functional but fragile in important paths, 7 means maintainable with the main correctness boundaries tested, and 9 means consistently reliable and well verified. These are judgment calls, not a numerical average or a measure of effort invested. The score reflects the app's advertised persistence and multi-user responsibilities; visual polish alone would not raise it.

### What is already good

- The deployment is small: one application process, SQLite, and static assets. There is no unnecessary distributed infrastructure.
- Dexie and `useLiveQuery` provide a straightforward reactive UI with durable local storage.
- Pages, components, hooks, authentication wrappers, and shared schema definitions are discoverable by their names and locations.
- Server-side ownership scoping and profile column projection provide useful authorization boundaries. OIDC uses an established verification library instead of custom JWT cryptography.
- Tests exercise real HTTP routes against temporary SQLite databases, including authorization failures, and use `fake-indexeddb` for hydration behavior.
- Translation and theme infrastructure already exist. They should be extended consistently rather than replaced.

### Verification performed

| Check | Result |
| --- | --- |
| `npm test` | Passed: 51 tests across 6 files. |
| `npm run build` | Passed: TypeScript checking and Vite production build. |
| `npm run lint` | Passed. Current ESLint rules target TS/TSX; this does not establish equivalent lint coverage for server JavaScript. |
| Production bundle | Main JavaScript asset approximately 859 kB minified / 253 kB gzip; Vite emitted a large-chunk warning. |

Passing checks are useful evidence, but the current suite does not exercise real browser navigation, concurrent sync, account changes during retries, or simultaneous edits from multiple devices.

## P0 — Fix correctness boundaries first

### 1. Make account changes and sync one coordinated lifecycle

**Evidence:** [src/main.tsx](src/main.tsx) starts sync before authentication/cache reconciliation. [src/db/sqliteSync.ts](src/db/sqliteSync.ts) stores queued payloads without a separate account identity and sends them using the current session cookie. [RequireAuth](src/components/RequireAuth.tsx) and [SettingsPage](src/pages/SettingsPage.tsx) delete/reopen the database during account changes or logout without coordinating in-flight sends.

**Why it matters:** queued work can be removed before delivery, or a mutation belonging to an old account can be sent under the next account's session. The server assigns ownership from that session, so trusting the payload's existing `userId` would not solve this.

**Suggested change:** introduce one lifecycle coordinator that resolves the session, selects/verifies the account cache, hydrates when necessary, and only then starts the sync worker. Attach account identity to every queued entry. Stop scheduling sends and await or cancel in-flight work before switching accounts. Retain pending work in an account-scoped store; make any explicit discard visible to the user. Aborting an HTTP request is not proof that the server did not commit it.

**Acceptance test:** queue a mutation for account A, switch to B while delivery is pending, and verify that it is neither applied to B nor silently deleted. Include the expired-session and logout cases.

### 2. Replace best-effort mutation hooks with a durable, serialized outbox

**Evidence:** [sqliteSync.ts](src/db/sqliteSync.ts) buffers only after a request fails. Update/delete hooks schedule work before transaction completion. Concurrent calls can bypass an active flush, and new work can be sent after an older queued item fails. All 4xx responses are treated as delivered, including 401 and 429.

**Suggested change:** write the domain change and outbox record in the same Dexie transaction, then let one worker deliver committed outbox entries in stable sequence. Prefer explicit mutation functions such as `addWorkoutSet` and `cancelWorkout` over implicit network side effects in table hooks. Keep direct reactive reads where they are simple.

Use explicit delivery outcomes:

| Outcome | Handling |
| --- | --- |
| Success | Acknowledge/remove the queued entry. |
| Network error / 5xx | Retain and retry with bounded backoff. |
| 401 | Pause and request reauthentication; retain work. |
| 429 | Retain and respect retry timing. |
| Validation/permission rejection | Preserve an actionable failed state; do not retry indefinitely or report successful sync. |

Give commands stable mutation IDs so retries after an ambiguous response can be recognized server-side. For multi-record operations, apply the command in one server transaction. Add a small user-facing pending/failed sync indicator using existing i18n infrastructure.

**Acceptance tests:** transaction rollback emits no mutation; a committed edit survives reload before the first send; a workout is delivered before its set; duplicate retries are safe; a rejected edit remains visible as failed.

### 3. Establish one account-deletion policy and enforce it everywhere

**Evidence:** [server/index.js](server/index.js) protects self-deletion and the last administrator in admin routes, but ordinary profile deletion through `/api/sync` bypasses those guards. Conversely, the admin deletion route deletes sessions and the account but leaves the six account-scoped domain tables behind.

**Why it matters:** safeguards depend on which endpoint is used, deletion leaves orphaned data, and SQLite's reusable integer account IDs make leftover account-owned rows particularly undesirable.

**Suggested change:** remove account deletion from generic profile synchronization. Provide an explicit account command with a documented self-deletion policy. Use one transaction to check administrator invariants and delete the account, sessions, and all owned records. Route every account-deletion entry point through it. Make setup's first-account check and creation atomic as well.

**Acceptance tests:** the last administrator cannot be removed through an alternate endpoint; failed deletion rolls back completely; deleting a user leaves no owned records; a subsequently created user cannot inherit deleted-account data; concurrent setup requests cannot both create the initial administrator.

## P1 — Make the persistence contract explicit

### 4. Choose a bounded multi-device consistency model

**Evidence:** local numeric IDs can collide between devices belonging to the same account. Composite `(userId, id)` keys only separate different users. [RequireAuth](src/components/RequireAuth.tsx) skips snapshots for a matching local account, and there is no continuous pull or conflict detection.

**Recommended direction for this product:** keep Dexie and offline mutation recording, use client-generated UUIDs for domain records, and begin with explicit server refresh plus record revisions. Flush or resolve pending work before replacing the cache. Reject stale revisions with an actionable conflict response instead of silently overwriting. Define deletion behavior too; adding background pull later requires a way to transmit deletions.

This is a coordinated schema/API change, not a quick replacement of ID types. If multi-device use is deferred, explicitly document one active device per account and avoid promising cross-device convergence. Do not build a CRDT or generic sync framework for this app without evidence that it is necessary.

**Acceptance tests:** two devices create different workouts offline without overwriting each other; an outdated edit is detected; refresh does not erase pending local changes.

### 5. Strengthen validation and relationships at the server boundary

**Evidence:** [shared/syncSchema.js](shared/syncSchema.js) lists allowed columns but does not validate field types, ranges, or required combinations. Generic table lookup uses a normal object's inherited property lookup. SQL has no declared foreign keys; only selected relationships receive explicit ownership checks.

**Suggested change:** validate request bodies as objects, validate table membership with an own-property check, and validate each mutation before constructing SQL. Check identifiers, finite numbers, allowed set types, required fields, and reasonable domain constraints. Verify gym, exercise, equipment, and workout references within the authenticated account. Add composite foreign keys/cascades where appropriate, enable enforcement, and retain clear application-level error messages.

Small explicit validators are enough initially; a new validation dependency is not required. Return deliberate 4xx error codes for malformed input rather than allowing database errors to turn into retryable 500s.

**Acceptance tests:** invalid types, inherited-property table names, non-existent references, and cross-account references are rejected predictably. Include both insert and update paths.

### 6. Document and test fresh-database initialization

**Evidence:** the working tree changes Dexie versions 2/3 to version 1 and rewrites SQLite primary keys. Seeding happens on Dexie creation, while hydration clears/replaces the exercise catalog—even when the server catalog is empty.

**Suggested change:** follow the repository's current fresh-install policy: keep edits in initial schemas rather than adding migrations now. Clearly state that these definitions do not upgrade earlier databases. Before supporting existing installations, introduce an explicit upgrade policy and tests.

Choose one owner for the default exercise catalog. A simple option is idempotent server-side seeding when an account is created, followed by snapshot hydration; use stable catalog identifiers to avoid duplication. Test setup, registration, OIDC account creation, logout/login, and a fresh second device. A successful empty snapshot should not accidentally remove the intended default catalog.

## P1 — Simplify ownership of behavior

### 7. Centralize session/bootstrap state and request failure handling

**Evidence:** `SessionProvider`, `RequireAuth`, `RequireAdmin`, `AuthPage`, and onboarding independently fetch session state. Guards have overlapping loading logic; some rejected requests escape without a useful error state. Hydration returns `false` for both request failure and absence of a profile.

**Suggested change:** let the session/bootstrap provider own a small explicit state model: loading, setup required, signed out, ready, or failed. Include cache preparation in the ready condition. Make route guards consume that state. Have one typed HTTP helper distinguish network errors, invalid responses, and API errors; keep authentication enforcement on the server.

Return distinct hydration outcomes so a network problem cannot masquerade as a new user needing onboarding. Read profiles by the current account ID instead of repeatedly selecting the first local row.

**Acceptance tests:** server failure offers retry rather than onboarding; login/logout refresh all consumers consistently; an administrator route does not need its own independent session fetch.

### 8. Extract a few cohesive modules, without creating a generic framework

**Evidence:** [server/index.js](server/index.js) contains database setup, SQL helpers, session management, setup, administration, OIDC, sync, and static serving. Importing it opens a database. On the client, mutation rules and transaction boundaries are split between UI, hooks, and storage hooks.

**Suggested server shape:** extract database initialization/access, account/session operations, OIDC operations, and sync operations. Route handlers should authenticate, validate, call an operation, and translate its result into HTTP. Separate `createApp(...)` from the process entrypoint so tests can supply a temporary database without import-time resource creation.

**Suggested client shape:** extract only meaningful write operations—workout lifecycle, profile/measurement updates, and catalog edits—so each owns its transaction and outbox entry. Keep simple `useLiveQuery` reads close to the UI. A repository interface for every table would add ceremony without solving the current problems.

Move code incrementally after adding behavior tests. File splitting alone will not improve the score; clearer ownership of invariants will.

## P2 — Improve maintenance and user experience

### 9. Keep exercise identity separate from translated display text

**Evidence:** [ManageExercisesPage](src/pages/ManageExercisesPage.tsx) initializes edits with the translated exercise name, then saves the edit as the stored name. Saving a seeded exercise can turn a translation key into a literal label. [ExerciseList](src/components/ExerciseList.tsx) searches translated values but its live-query dependencies only include the search string. Older literal muscle groups can form separate buckets from newer key-based groups.

**Suggested change:** preserve the original catalog key unless the user explicitly renames the exercise; alternatively separate `catalogKey` and custom display name. Use stable muscle-group codes and one shared ordered definition for forms, grouping, and translation. Include language in localized search dependencies. Keep custom names as literal user data.

**Acceptance tests:** changing language updates an active search; saving an unchanged seeded exercise preserves translation; custom names remain intact.

### 10. Make failures and touch behavior deliberate

**Evidence:** [WorkoutPage](src/pages/WorkoutPage.tsx) navigates away even if cancellation fails. [Layout](src/components/Layout.tsx) binds both pointer-up and click to navigation, and the resume banner is a clickable `div`.

**Suggested change:** display a translated error and keep the user on the workout when deletion fails. Investigate the original touch issue with a focused browser reproduction, then use one activation path and native links/buttons with keyboard access. Add accessible names to icon-only controls. Do not hide the root cause with additional event handlers.

### 11. Reduce redundant state and defer heavy screens

- `GymList` derives visit counts from completed workouts, while `Gym` also persists visit statistics. Choose derivation as the source of truth unless profiling justifies a cache; if cached, update it in the owning transaction.
- Lazy-load analysis and admin routes so charts and admin forms do not all ship on the initial route. The measured 859 kB main bundle makes this a concrete optimization opportunity. Re-measure startup and route loading after splitting; avoid adding chunk configuration solely to suppress warnings.
- Hide the empty General admin tab until it provides a function.
- Preserve existing Tailwind, i18n, Dexie, and small React hooks. No state-management library, ORM, microservices, or wholesale server TypeScript rewrite is needed to address the main findings.

### 12. Make existing checks a release gate, then fill specific coverage gaps

Add `npm test`, `npm run lint`, and `npm run build` to CI before image publication. Extend the existing ESLint configuration to server/shared JavaScript with appropriate Node globals. Normalize line endings in a separate small change, and update stale local-only/user-ID guidance.

Prioritize tests for account switching, durable retries, account deletion, transaction rollback, and two-device conflicts. Extend current HTTP and fake-IndexedDB tests where possible. Add a small browser smoke suite later for setup → login → workout → cancellation/logout and keyboard/mobile navigation; adding a browser runner is a tooling decision for a separate implementation task. Document any new test files in `AGENTS.md` as required by the repository.

Keep real workout-history CSV files only if their purpose and retention are intentional. If test fixtures are needed, use a small synthetic fixture instead of coupling tests or app initialization to a personal export.

## Suggested order of work

1. Add regression tests for account isolation and deletion; fix deletion policy, cleanup, and first-admin atomicity.
2. Coordinate authentication/cache lifecycle with an account-bound durable outbox and one delivery worker.
3. Define multi-device IDs, revisions, refresh, and deletion semantics; implement only the chosen contract.
4. Tighten validation/relationships and make catalog initialization deterministic.
5. Consolidate session handling and extract operations while preserving passing behavior tests.
6. Address translated editing, cancellation feedback, accessibility, route splitting, and CI coverage.

Items 1–4 would provide the largest improvement in confidence. The path toward 8/10 is demonstrably reliable data/account behavior and simpler ownership of that behavior, followed by broader automated checks—not more abstractions or more features. This document proposes work; it does not implement these changes.
