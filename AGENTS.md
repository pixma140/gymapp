# AGENTS.md

This file is for agentic coding tools operating in this repo.
Keep changes consistent with existing patterns and scripts.

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
- Layout:
  - `server/lib/*.test.js`: pure server helpers (password hashing, cookies, OIDC verify).
  - `server/sync.test.js`: HTTP integration test of `/api/sync` authz/scoping (boots the Express app on an ephemeral port against a temp SQLite DB).
  - `server/adminUsers.test.js`: HTTP integration test of `/api/admin/users` routes (list/create/promote/demote/password-reset/delete authz and guards).
  - `test/api.test.ts`: typed API error classification, malformed bootstrap responses, and failed logout.
  - `test/*.test.ts`: client-side logic (account-cache isolation, hydration, transactional outbox, and dependent acknowledgements via `fake-indexeddb`).
  - `test/serverReset.test.ts`: end-to-end installation reset isolation between the real server sync contract and account-specific IndexedDB caches.
- `server/app.js` exports `createApp({ database, ...config })` without opening a database or binding a port. Tests explicitly initialize and close handles from `server/db.js`; `server/index.js` owns process startup.
  - `server/seed.test.js`: fixture authentication/restart behavior, fresh-schema invariants, and scoped reset/lease guards.
  - `server/config.test.js`: environment validation, admin configuration authorization, env-only credentials, OIDC precedence and login wiring.
- `test/browser/workflows.spec.ts`: Playwright mobile-width account, timed-workout, history-deletion failure/retry, bootstrap-retry, and two-tab lifecycle tests; `test/browser/server.mjs` owns its temporary database. Run `npm run build`, `npm run test:browser:install` once, then `npm run test:browser`.
- `server/db.test.js`: database isolation, transaction serialization, rollback isolation, and closed-handle guards.

## Cursor/Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.
- If any are added later, mirror them here.

## Code Style (Observed)
- TypeScript + React function components.
- Files: components and pages use `PascalCase` names.
- Hooks: `useX` naming in `src/hooks`.
- Prefer named exports for pages/components.
- Semicolons are used in most TSX files.
- Indentation is typically 4 spaces in TS/TSX files.
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
- Entities: account profile, shared Gym, private timed Workout and UserMeasurement, mutation outbox, and sync metadata. Domain IDs are UUID strings; account IDs remain integers.
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
- Use a concise commit message describing the change. Pushes, tags, and releases require a separate user request.

## Adding Features
- Match current UI patterns (card layout, bold headers, muted text).
- Keep layouts mobile-first; many screens center on `max-w-md`.
- Prefer lightweight hooks for stateful flows.
- Reuse existing forms/components before creating new ones.
- Add tests for new features alongside the code:
  - New/changed server routes: add or extend an HTTP integration test (mirror
    `server/sync.test.js` / `server/adminUsers.test.js`).
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
- App routes: `src/App.tsx`
- DB schema: `src/db/db.ts`
- Utilities: `src/lib/utils.ts`
- Main entry: `src/main.tsx`

## Single-Test Guidance
- Run all tests: `npm test`.
- Run a single test file: `npx vitest run server/lib/crypto.test.js`.
- Run a single test by name: `npx vitest run -t "rejects an expired token"`.
- Watch mode: `npm run test:watch`.
