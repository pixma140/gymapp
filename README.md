# gymapp

A local-first workout tracker built with React, TypeScript, Tailwind,
Dexie, Express, and SQLite. Accounts require server authentication. Once an
account cache is ready, local edits and their outgoing commands are stored
atomically in IndexedDB and survive connectivity interruptions.

Select a gym, start a workout, and add exercises through a searchable modal.
Exercises are ordered by your usage frequency and filterable by grouped muscle
categories. Log weight/reps as warmup or working sets, create private custom
exercises, and finish the session. Analysis shows completed workouts with exercise
and set summaries; open a workout to view or edit its sets. Exercise History shows
sets from previous completed sessions. Changes save locally as you go and sync
automatically, including custom exercises. Settings exports include these records.

The bundled catalog is imported from a pinned `exercises-dataset` revision using
`npm run exercises:import`; no runtime GitHub request is needed. See
`THIRD_PARTY_NOTICES.md` for attribution. The workout flow uses compact headers,
bordered exercise cards, warmup badges, and modal selection inspired by the demo
screenshots. Gym management remains restricted to administrators.

## Development

```bash
npm install
# Copy env.example to .env and set your local configuration and credentials.
npm run dev:server
# In a second terminal:
npm run dev
```

The API and reset commands load `.env` using Node's built-in environment loader.
Exported variables take precedence. `env.example` uses `PORT=3000`,
`DATA_DIR=./db`, and `VITE_API_TARGET=http://localhost:3000` for local development.
Keep `.env` private; it is excluded from Git and Docker build contexts.
Leave `NODE_ENV` out of the shared `.env`; Compose sets it for the server and
Vite selects the correct mode for development or production builds.

Development fixtures are initialized **once** on a fresh installation when
`SEED_DEV_DATA=true`. Set `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`,
`SEED_USER_USERNAME`, and `SEED_USER_PASSWORD` first. Usernames must be distinct
and at least three characters; passwords must be at least eight characters.
There are no built-in credentials. The accounts have administrator and regular
user roles respectively. Tests generate disposable credentials for each run.

Both accounts see the same UUIDs for **Iron Odyssey** (Foundry District) and
**Moonshot Barbell Club** (Riverside Hangar). Only administrators can create,
rename, or archive gyms. Archiving retains workout history; completed-workout
visits are calculated from the signed-in account's private workouts. An admin
cannot read another account's workout history through sync.

Restarting fixture mode preserves changed passwords, roles, gym names, and
intentionally deleted accounts. `ADMIN_USERNAME` never repairs fixture roles.
Enabling fixtures on an installation initialized without fixtures is refused.

## Alpha database policy and reset

Until the project leaves alpha, schema changes are intentionally breaking and
assume a fresh database. Update the initial SQLite DDL and single Dexie
`version(1)` definition directly. There are no migrations, schema-version checks,
version increments, or compatibility/cleanup paths for previous schemas.
Recreate development databases after schema changes; ordinary restarts preserve
data for the current schema.

Stop the API first (Ctrl-C, or `docker compose stop gymapp`), then run:

```bash
npm run db:reset:seed   # reset ./db/gymapp.db and create the fixture baseline
npm run db:reset        # reset without fixtures; next startup offers setup
```

For a different directory, set `DATA_DIR` when invoking either command. Reset
removes only `gymapp.db`, `gymapp.db-wal`, and `gymapp.db-shm` in that directory.
It creates a new installation UUID, so old account queues cannot target reset
accounts. A server/reset lock prevents concurrent use by application processes.
After a crash, a stale `gymapp.db.lock` may remain: verify all processes and
containers using that directory are stopped before removing that lock file.

For client-only schema changes, delete the app's account IndexedDB databases
through browser developer tools before reloading, or reset the server to create
a new installation identity and fresh account caches.

Account caches survive ordinary startup/logout. Settings offers an explicitly
confirmed discard of pending local changes followed by a server reload; export
first if you need to retain pending intent.

## Non-fixture setup and Docker

```bash
SEED_DEV_DATA=false PORT=3000 DATA_DIR=./db node server/index.js
```

An empty non-fixture installation offers first-administrator setup. Regular
registration creates non-admin accounts. Concurrent setup requests cannot create
multiple first admins.

```bash
docker build -t gymapp .
docker run --env-file .env -e PORT=80 -e DATA_DIR=/app/data -e NODE_ENV=production -p 8080:80 -v "$(pwd)/db:/app/data" gymapp
```

Compose reads `.env`, including OIDC settings and credentials, and uses a Traefik
network. Container `PORT`, `DATA_DIR`, and `NODE_ENV` are explicitly overridden to
match its runtime. The host database mount follows `DATA_DIR` from `.env`.
Disable `SEED_DEV_DATA` for a non-fixture installation. Docker excludes local
environment files, databases, `history.csv`, and exercise-extraction artifacts.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `80` | Express listening port |
| `DATA_DIR` | `/app/data` | Directory containing `gymapp.db` |
| `SEED_DEV_DATA` | `false` | One-time development fixtures on a fresh installation |
| `COOKIE_SECURE` | `false` | Secure session cookie when served over HTTPS |
| `ADMIN_USERNAME` | unset | Non-fixture startup admin promotion; environment-only |
| `PUBLIC_URL` | detected | Base URL for OIDC callback construction |
| `NODE_ENV` | `development` | Runtime mode; Compose uses `production` |
| `VITE_API_TARGET` | `http://localhost:80` in Vite | Local development API proxy target |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | unset | Fixture administrator credentials; environment-only |
| `SEED_USER_USERNAME`, `SEED_USER_PASSWORD` | unset | Fixture regular-user credentials; environment-only |
| `OIDC_ENABLED` | unset | Optional `true`/`false` override for SSO enablement |
| `OIDC_ISSUER` | unset | Optional issuer URL override |
| `OIDC_SCOPES` | `openid profile email` | Optional scope override |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | unset | Provider credentials; environment-only |

Admin → General displays effective non-secret server settings with their source
and purpose. Change deployment settings in the environment and restart to apply.
Admin → OIDC displays environment-provided issuer, scopes, and enablement as
read-only fields. Unset OIDC fields remain editable and are saved in SQLite.
The API enforces environment precedence. OIDC client credentials are neither
returned by configuration APIs nor saved through the admin form; only their
configured/missing status is shown. Ordinary user creation and password resets
remain available in Admin → Users.

Set OIDC credentials in `.env` or Compose's environment, restart, and use the
displayed callback URL when configuring your provider. Enable OIDC in the
environment or admin form after supplying the issuer and credentials.

For credentials previously published in Git, rotate them at the provider or
reset the affected account password. Moving values into `.env` does not remove
them from Git history. Changing fixture environment credentials affects fresh
databases only; use the explicit alpha reset when recreating development data.

## Sync behavior and current limits

Account, domain, mutation, and installation IDs are RFC 9562 UUID v7 strings generated
with the `uuid` package on the client and server. They use lowercase canonical
`xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx` formatting with a leading Unix
millisecond timestamp. API/cache validation and initial SQLite constraints
require v7. Setup, registration, admin-created accounts, OIDC accounts, and fixtures
all receive server-generated v7 account IDs. Each
account/installation pair has a separate IndexedDB database. Explicit commands
carry both identities, a mutation UUID, and expected revision. The server
validates and commits a mutation plus its receipt in one transaction; retries
return the saved result instead of applying the mutation twice.

UUID ordering improves index locality but does not replace explicit workout
timestamps or the outbox sequence; device clocks can differ. UUIDs are identifiers,
not authentication secrets. This alpha change requires fresh server/browser
databases under the reset policy above; schema definitions stay at their initial version.

The client retains failed or ambiguous work. A browser Web Lock permits one
sender per account across tabs; browsers without Web Locks retain their queue.
Use HTTPS or localhost for the browser capabilities needed by synchronization.
Network and server failures use persisted exponential backoff; rate limits honor
`Retry-After`. Account/catalog generation changes pause a dirty cache for review
before its first delivery. Refresh never replaces pending work silently.
Conflicts can discard the rejected dependency chain or reapply reviewed intent
against current server revisions with new mutation IDs. Settings can export all
pending intent before either discard path. There is no automatic merge,
continuous background pull, service worker, or offline cold start.

Bootstrap failures offer Retry and preserve cached data and pending changes.
Tabs coordinate senders and login/logout using Web Locks and session-change
notifications. A tab following an account switch opens the new account's cache;
the previous account's pending queue stays in its own cache. Browsers without
Web Locks retain pending work without sending it. A new browser session still
requires the server to authenticate and prepare its cache.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:browser:install   # install Chromium once
npm run test:browser           # uses the built dist/; temporary fixture database
```

Vitest covers password/cookie/OIDC helpers, server transactions, setup/admin
HTTP authorization, command validation/idempotency/scoping, fixture/reset
behavior, and account-local IndexedDB hydration and durable operations.
Playwright exercises mobile-width login, shared gyms, timed workouts,
account switching, private history, and deletion against a throwaway server.
`npm run test:watch` starts Vitest watch mode; `npm run preview` previews a build.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, persistence
details, and the behavior contract the test suites enforce.

The `Release` workflow (`.github/workflows/release.yml`) runs only for release
tags (`latest` or `v*`) and manual `workflow_dispatch` runs; ordinary commits and
pull requests start no pipeline, so run the local checks above before tagging.
Its three jobs run in order:

| Job | Runs when | Does |
| --- | --- | --- |
| `verify` | always | Installs dependencies and Chromium, then Vitest, ESLint (including server/shared JavaScript), the production build, and the Playwright workflows. Uploads the report as an artifact when a browser run fails. |
| `publish-image` | tags, after `verify` | Builds the amd64 and arm64 images and pushes `:latest`, `:<tag>`, and `:<sha>` to GHCR, so a failing tag publishes nothing. |
| `create-release` | `v*` tags, after `publish-image` | Creates or updates the GitHub release from the `## <tag>` section of [RELEASE_NOTES.md](RELEASE_NOTES.md), falling back to a commit summary. Tags with a suffix such as `-alpha` are marked as pre-releases. Finally moves the Git `latest` tag to the published release commit. |

The Git `latest` tag tracks the most recently published release, including alpha
releases, alongside the Docker `:latest` image. Automation updates it using
`GITHUB_TOKEN`, so that tag update does not trigger another workflow run.

To verify a branch without tagging it, start the workflow manually from the
Actions tab (`gh workflow run Release --ref <branch>`); the `publish-image` and
`create-release` jobs stay skipped unless the selected ref is a tag.
