# AGENTS.md

This file is for agentic coding tools operating in this repo.
Keep changes consistent with existing patterns and scripts.

## Documentation
Three documents lead; keep each within its role and update the one that owns a fact.
- `README.md`: users and operators. Features, setup, environment variables, database reset, verification, CI/release pipeline, roadmap.
- `ARCHITECTURE.md`: module boundaries, persistence and sync contract, and the behavior the test suites enforce.
- `AGENTS.md`: conventions, test inventory, commit and release process for agents.
- `RELEASE_NOTES.md` is append-only per release; `THIRD_PARTY_NOTICES.md` records attribution.
- Do not add other long-lived Markdown files or a `docs/` folder. Historical plans, checkpoints, and assessments are not kept in-tree; Git history and release notes preserve them.
- Open ideas that are not yet implemented belong in the README roadmap section, not in separate idea files.
- `demo/` (Git- and Docker-ignored, may be absent) holds local reference material the user hands to agents, such as UI mockup screenshots or CSV exports from other trackers. Read it when a task refers to it; never commit it or depend on it from code or tests.

## Repo Overview
- Vite + React + TypeScript (ESM) app.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Data is local-first using Dexie (IndexedDB).
- Routing via `react-router-dom` with nested layouts.
- Path alias: `@/*` -> `src/*` (see `tsconfig.app.json`).

## Commands (npm)
- Install: `npm install`
- Dev frontend: `npm run dev`; API: `npm run dev:server` (loads local `.env`; see `env.example`).
- Explicit app database reset: stop the API, then `npm run db:reset:seed` (or `db:reset` without fixtures).
- Build: `npm run build` (runs `tsc -b` then `vite build`)
- Lint: `npm run lint` (eslint)
- Preview build: `npm run preview`

## Tests
- Runner: Vitest (`vitest`).
- Run all tests: `npm test` (alias for `vitest run`).
- Watch mode: `npm run test:watch`.
- Run a single test file: `npx vitest run server/lib/crypto.test.js`.
- Run tests matching a name: `npx vitest run -t "rejects an expired token"`.
- Config: `vitest.config.ts` (node environment, `@`/`@shared` aliases, `NODE_ENV=test`).
- `server/app.js` exports `createApp({ database, ...config })` without opening a database or binding a port; it wires `server/services/*` into the routers in `server/routes/*`. Tests explicitly initialize and close handles from `server/db.js`; `server/index.js` owns process startup.
- Server unit tests (`server/lib/*.test.js`):
  - `server/lib/crypto.test.js`: password hashing and cookie helpers.
  - `server/lib/oidc.test.js`: OIDC token verification.
- Server integration tests (`server/*.test.js`, boot the Express app on an ephemeral port against a temp SQLite DB):
  - `server/sync.test.js`: `/api/sync` authz/scoping, command validation, idempotency.
  - `server/adminUsers.test.js`: `/api/admin/users` list/create/promote/demote/password-reset/delete authz and guards.
  - `server/seed.test.js`: fixture authentication/restart behavior, fresh-schema invariants, and scoped reset/lease guards.
  - `server/config.test.js`: environment validation, admin configuration authorization, env-only credentials, OIDC precedence and login wiring.
  - `server/db.test.js`: database isolation, transaction serialization, rollback isolation, and closed-handle guards.
- Client tests (`test/*.test.ts`, IndexedDB via `fake-indexeddb`):
  - `test/api.test.ts`: typed API error classification, malformed bootstrap responses, and failed logout.
  - `test/hydrate.test.ts`: account-cache isolation, hydration, transactional outbox, dependent acknowledgements, and conflict resolution.
  - `test/exerciseCatalog.test.ts`: bundled exercise catalog grouping, cardio additions, filtering, and per-account usage ranking with history deletion.
  - `test/gymCatalog.test.ts`: personal gym visit ranking, account isolation, and history-driven updates.
  - `test/serverReset.test.ts`: end-to-end installation reset isolation between the real server sync contract and account-specific IndexedDB caches.
  - `test/docs.test.ts`: documentation drift guard; fails when a test file is missing from this inventory, a documented `npm run` script does not exist, or a Markdown file outside the leading documents appears.
- Browser tests (Playwright, not part of `npm test`):
  - `test/browser/workflows.spec.ts`: mobile-width account, timed-workout, history-deletion failure/retry, bootstrap-retry, and two-tab lifecycle tests; `test/browser/server.mjs` owns its temporary database. Run `npm run build`, `npm run test:browser:install` once, then `npm run test:browser`.

## Code Style (Observed)
- TypeScript + React function components.
- Files: components and pages use `PascalCase` names.
- Hooks: `useX` naming in `src/hooks`.
- Prefer named exports for pages/components.
- Semicolons are used in most TSX files.
- Indentation is 4 spaces in most TS/TSX files; `src/App.tsx` and the root config files use 2. Match the file you edit.
- Strings mostly use single quotes; match existing file style.

## Formatting Expectations
- Keep JSX readable with one prop per line when long.
- Prefer early returns for loading/empty states.
- Use Tailwind utility classes for layout and styling.
- Use `cn` helper from `src/lib/utils.ts` for conditional classes.
- Avoid introducing a new formatter unless the repo adds it.

## Imports
- Use path alias `@/` for app code when possible.
- Group imports by source:
  - External packages first.
  - App modules next.
  - Styles last.
- Use `type` imports where appropriate (see `db/db.ts`).

## TypeScript & Types
- `strict` is enabled; avoid `any` unless justified.
- Keep types close to usage; co-locate interfaces with data models.
- Prefer union literals for enums (e.g. `'warmup' | 'working'`).
- Avoid unused locals/params (TS config enforces this).

## Data & State
- IndexedDB via Dexie; see `src/db/db.ts` for schema.
- `useLiveQuery` is used for reactive queries.
- Use Dexie transactions for multi-table updates/deletes.
- Domain screens use `useDatabase()` from SessionContext; preferences use its nullable `database` handle. No global database or assumed account ID.
- Domain writes go through `applyOperation`, which atomically updates local data and queues an account/installation-bound command.

## Routing
- Routes are declared in `src/App.tsx`.
- Use nested routes under `Layout`.
- Workout routes use both `gymId` and `workoutId` patterns.

## Error Handling & UX
- Confirm destructive actions with `window.confirm`.
- Keep UI responsive during async operations.
- Prefer safe fallbacks (e.g., "Unknown Gym") rather than crashing.
- Handle missing data defensively (`null`/`undefined` checks).

## Naming Conventions
- Components: `PascalCase` (file + export).
- Hooks: `useSomething`.
- Functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- CSS variables: `--kebab-case`.

## Styling & UI
- Tailwind classes used heavily; keep class lists ordered logically.
- Theme variables are in CSS and read via `var(--...)`.
- Avoid introducing new global CSS unless necessary.
- Use existing components (e.g. `Tabs`, `Layout`) where possible.

## i18n & Theme
- Language context at `src/i18n/LanguageContext.tsx`.
- Theme context at `src/context/ThemeContext.tsx`.
- Use `useLanguage()` for user-facing text when available.
- All user-facing text must be wired through the existing i18n keys (no hardcoded strings).

## Database Schema Notes
- Entities: account profile, shared Gym, private timed Workout with its WorkoutExercise sets, private custom Exercise, UserMeasurement, mutation outbox, and sync metadata. The bundled exercise catalog (`shared/exercises.js`) is static and not stored per account. Account, domain, mutation, and installation IDs are canonical lowercase UUID v7 strings generated with `v7` from `uuid`; account IDs are generated by the server. Runtime validators and initial SQLite constraints require v7. Authentication secrets use cryptographic randomness, not time-ordered IDs.
- Until the project leaves alpha, all schema changes are intentionally breaking
  and assume a freshly created database. Edit the initial SQLite `CREATE TABLE`
  statements in `server/schema.js` and the single Dexie `version(1)` schema in
  `src/db/db.ts` directly.
- Do not add migrations, `ALTER TABLE`, Dexie version increments or upgrade hooks,
  schema-version tracking/checks, or compatibility/cleanup code for previous schemas.
- Recreate development databases when the schema changes. Ordinary restarts still
  preserve data for the current schema.

## Deployment Configuration
- `env.example` documents supported variables; local `.env` files are ignored by Git and Docker.
- Deployment usernames, fixture passwords, and OIDC client credentials come only from the server environment. Tests generate disposable credentials.
- Configuration APIs use explicit non-secret allowlists. Environment-managed fields are read-only in the admin UI and enforced by the API; unset OIDC fields remain editable.

## Completion and Commits
- After completing each feature, fix, refactor, documentation update, or other change, run the relevant checks and create a Git commit before reporting completion, unless the user explicitly asks otherwise.
- Review the diff and stage only files belonging to the completed work; keep secrets and unrelated user changes out of the commit.
- When a change adds a test file, npm script, top-level module, or schema entity, update `AGENTS.md` (and `ARCHITECTURE.md` or `README.md` if they own the fact) in the same commit; `test/docs.test.ts` enforces part of this.
- Use Conventional Commits: `<type>[optional scope][!]: <description>`. Choose the appropriate type, such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, or `style`.
- Keep the description concise and imperative, for example `fix(sync): preserve pending changes on retry` or `docs: clarify database reset instructions`.
- Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer, including required setup actions. This applies during alpha too.
- Pushes, tags, and releases require a separate user request.

## Release Procedure
Use this procedure only after the user explicitly requests a tag or release.

1. Inspect `git status`, `git log --oneline -10`, local tags, and
   `gh release list`. Treat the newest GitHub release as authoritative because a
   release tag may exist remotely without being available locally. Resolve its
   commit with `gh api repos/{owner}/{repo}/git/ref/tags/{tag}` and review every
   commit from that SHA through `HEAD`.
2. Choose the next semantic version from the unreleased commits. During alpha,
   breaking changes or substantial features bump the minor version; fixes alone
   bump the patch version. Keep the `-alpha` suffix until the user requests a
   stable release.
3. Add a `## <tag>` section at the top of `RELEASE_NOTES.md`. State breaking
   setup/reset requirements first, then summarize user-visible changes. Set the
   same version without the leading `v` in `package.json` and the root package
   entries in `package-lock.json`.
4. Run `npm test`, `npm run lint`, `npm run build`, and
   `npm run test:browser`. A warning is non-blocking only when the command exits
   successfully and the warning is understood and reported.
5. Review the release diff and commit only the release-note/version files with
   `chore(release): prepare <tag>`. Confirm the worktree is clean and the release
   commit contains the intended files.
6. Publish `main` before the tag. If the configured SSH remote stalls, use GitHub
   CLI authentication over HTTPS without changing Git configuration:
   `git -c credential.helper='!gh auth git-credential' push https://github.com/{owner}/{repo}.git main:main`.
7. Create an annotated tag on the release commit with
   `git tag -a <tag> -m "Release <tag>"`, then push that tag using the same
   authenticated HTTPS form. Do not create the GitHub release manually: the tag
   starts `.github/workflows/release.yml`, which verifies the commit, publishes
   multi-architecture images, creates the prerelease when the tag has a suffix,
   and moves `latest`.
8. Find the tag run with `gh run list --workflow Release`, then wait with
   `gh run watch <run-id> --exit-status`. Completion requires all three hosted
   jobs to pass, `gh release view <tag>` to return the published release, and the
   remote `latest` tag to resolve to the release commit. Refresh local remote/tag
   refs afterward so `git status` and future release comparisons are accurate.

## Adding Features
- Match current UI patterns (card layout, bold headers, muted text).
- Keep layouts mobile-first; many screens center on `max-w-md`.
- Prefer lightweight hooks for stateful flows.
- Reuse existing forms/components before creating new ones.
- Add tests for new features alongside the code:
  - New/changed server routes: put handlers in the matching `server/routes/*.js` router (or a new one mounted in `server/app.js`), keep SQL and business rules in `server/services/*`, and add or extend an HTTP integration test (mirror `server/sync.test.js` / `server/adminUsers.test.js`).
  - New server helpers: add a focused unit test under `server/lib/*.test.js`.
  - New client logic (Dexie/state/hydration): add a `test/*.test.ts` test.
  - Cover authz/guards, validation/error codes, and the happy path.
  - Run `npm test` before finishing; keep the suite green.
  - Document any new test file in the Tests section above.

## Linting
- ESLint config is in `eslint.config.js` (flat config).
- React hooks rules enabled; ensure hooks are called correctly.

## Do / Don't
- Do keep imports tidy and consistent with local file style.
- Do use `@/` alias for app modules.
- Do keep changes scoped; avoid refactors unless requested.
- Do add tests for new features (see "Adding Features") and keep `npm test` green.
- Don't add new tooling without user request.
- Don't ship a new feature or route without test coverage.
- Don't introduce a new test file without documenting it in the Tests section.

## Quick File Pointers
- Architecture and module table: `ARCHITECTURE.md`
- App routes: `src/App.tsx`
- Main entry: `src/main.tsx`
- Client DB schema: `src/db/db.ts`; server DDL: `server/schema.js`
- Domain writes and outbox: `src/db/operations.ts`, `src/db/sqliteSync.ts`, `src/db/hydrate.ts`
- Command contract shared by client and server: `shared/commands.js` + `shared/commands.d.ts`
- Bundled exercise catalog: `shared/exercises.js` is generated by `npm run exercises:import` (`scripts/import-exercises.mjs`, pinned upstream revision); do not hand-edit it. Update `THIRD_PARTY_NOTICES.md` when the revision changes.
- Utilities: `src/lib/utils.ts`
- Translations: `src/i18n/translations.ts`

## Single-Test Guidance
- Run all tests: `npm test`.
- Run a single test file: `npx vitest run server/lib/crypto.test.js`.
- Run a single test by name: `npx vitest run -t "rejects an expired token"`.
- Watch mode: `npm run test:watch`.
