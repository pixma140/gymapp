# Release notes

## v0.2.0-alpha

Breaking: this release replaces the local and server schemas without a
migration path. Existing installations must start from a fresh database
(`npm run db:reset:seed`, or delete the mounted `db` volume); old browser caches
are discarded automatically once. Exercise logging is temporarily removed.

- Replace the SQLite and Dexie schemas: integer account IDs without reuse, UUID
  domain IDs, foreign-key cascades, record revisions, account/catalog
  generations, mutation receipts, and an installation identity (6d8b5b4)
- Make gyms an application-wide shared catalog managed by administrators, with
  archiving instead of deletion and per-user derived visit counts (7e92761)
- Add deterministic development fixtures behind `SEED_DEV_DATA`, a one-time seed
  marker, and scoped `db:reset` / `db:reset:seed` commands (6d8b5b4)
- Move account creation, role changes, deletion, and password reset into
  serialized service transactions with last-admin and self-action guards
  (6041ce2, 9ee9f0c)
- Replace arbitrary table sync with validated, account- and
  installation-bound command envelopes, revision checks, and idempotent
  mutation receipts (36cbbf6)
- Add a durable transactional outbox: local state and outgoing intent commit
  together, an ordered Web-Lock worker retries with backoff and `Retry-After`,
  and validation/permission/conflict failures stay visible and actionable
  (36cbbf6)
- Centralize session lifecycle in one bootstrap provider with account-local
  IndexedDB caches, typed error classification, multi-tab coordination, and
  failure-atomic discard/refresh that never silently drops pending work
  (3d37858, 6d03668, b8392ed)
- Remove the exercise, equipment, and set implementation, including its
  components, routes, seeds, sync branches, and translations. Timed workouts,
  gym selection, profile, measurements, and body-progress analysis remain
  (5218ff8)
- Report recoverable errors when workout history deletion fails, and disable
  deletion while it is pending (5a53f32)
- Extend Vitest coverage to 113 tests, add nine Playwright workflows, lint
  server/shared JavaScript, and lazy-load admin/analysis chunks (4053626)
- Publish only from GitHub Actions after tests, lint, build, and browser
  workflows pass; remove GitLab CI (720553b)

## v0.1.5-alpha

- add sqlite-backed multi-user auth and scoped sync persistence (bf8add3)
- change version slug (6a81962)
- add github url to footer (262d72e)

## v0.1.4-alpha

- add seconds to active workout timer (c0d008b)
- allow zero weight exercises (26cc72f)
- add possibility to cancel running workout (11700cb)
- align punctuation in translations (13b93f3)
- color adjustments (0fc133a)
- add review range to analysis screen (e0a7f4b)
- make analysis diagrams toggleable (6af183b)
- fix button alignment (3747ef3)
- add possibility to add a new gym in manage gym screen (f50b954)
- add possibility to change muscle group on exercise edit page (88a6e96)
- add possibility to change gym location too (830e99f)

