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
- Dev server: `npm run dev`
- Build: `npm run build` (runs `tsc -b` then `vite build`)
- Lint: `npm run lint` (eslint)
- Preview build: `npm run preview`

## Tests
- No test runner or `test` script is configured yet.
- Single-test command: not available until tests are added.
- If adding tests, document the runner and single-test command here.

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
- User is currently assumed as `userId: 1` (local-only).

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
- Entities: User, Gym, Exercise, GymEquipment, Workout, WorkoutSet, UserMeasurement.
- Schema versions: currently `version(2)` and `version(3)` in `db.ts`.
- Update schema carefully; Dexie migrations must be explicit.

## Adding Features
- Match current UI patterns (card layout, bold headers, muted text).
- Keep layouts mobile-first; many screens center on `max-w-md`.
- Prefer lightweight hooks for stateful flows.
- Reuse existing forms/components before creating new ones.

## Linting
- ESLint config is in `eslint.config.js` (flat config).
- React hooks rules enabled; ensure hooks are called correctly.

## Do / Don't
- Do keep imports tidy and consistent with local file style.
- Do use `@/` alias for app modules.
- Do keep changes scoped; avoid refactors unless requested.
- Don't add new tooling without user request.
- Don't introduce tests without documenting commands here.

## Quick File Pointers
- App routes: `src/App.tsx`
- DB schema: `src/db/db.ts`
- Utilities: `src/lib/utils.ts`
- Main entry: `src/main.tsx`

## Single-Test Guidance (Placeholder)
- Currently no test runner.
- When tests exist, add:
  - How to run all tests.
  - How to run a single test file.
  - How to run a single test by name.
