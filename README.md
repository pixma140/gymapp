# gymapp

A local-first timed-workout tracker built with React, TypeScript, Tailwind,
Dexie, Express, and SQLite. Accounts require server authentication. Once an
account cache is ready, local edits and their outgoing commands are stored
atomically in IndexedDB and survive connectivity interruptions.

Exercise logging is temporarily unavailable. Gym selection, timed workout
start/resume/finish/cancel, private history, profiles, and body measurements
remain available. External exercise integration is a future task.

## Development

```bash
npm install
npm run dev:server
# In a second terminal:
VITE_API_TARGET=http://localhost:3000 npm run dev
```

The API development command defaults to `PORT=3000`, `DATA_DIR=./db`, and
`SEED_DEV_DATA=true`. Vite's proxy otherwise defaults to `http://localhost:80`.

Development fixtures are initialized **once** on a fresh installation:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `123geheim` | Administrator |
| `user` | `123geheim` | Regular user |

Both accounts see the same UUIDs for **Iron Odyssey** (Foundry District) and
**Moonshot Barbell Club** (Riverside Hangar). Only administrators can create,
rename, or archive gyms. Archiving retains workout history; completed-workout
visits are calculated from the signed-in account's private workouts. An admin
cannot read another account's workout history through sync.

Restarting fixture mode preserves changed passwords, roles, gym names, and
intentionally deleted accounts. `ADMIN_USERNAME` never repairs fixture roles.
Enabling fixtures on an installation initialized without fixtures is refused.

## Explicit reset

The schema is for a fresh WIP installation. Legacy databases are rejected with
`database_reset_required`; there is no automatic migration or startup wipe.
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
Do not reset a database used by an older server that predates the lock.

The browser clears the known legacy `GymAppDB` cache once when preparing its
first account cache. It records completion in `GymAppCacheControl`; unrelated
IndexedDB databases, local storage, and source exports are untouched. Modern
account caches survive ordinary startup/logout. Settings offers an explicitly
confirmed discard of pending local changes followed by a server reload; export
first if you need to retain pending intent.

## Non-fixture setup and Docker

```bash
SEED_DEV_DATA=false PORT=3000 DATA_DIR=./db node server/index.js
```

An empty non-fixture installation offers first-administrator setup. Regular
registration creates non-admin accounts; OIDC remains optional and is configured
in the admin area. Concurrent setup requests cannot create multiple first admins.

```bash
docker build -t gymapp .
docker run -p 8080:80 -v "$(pwd)/db:/app/data" gymapp
```

The current Compose file is a **development** configuration with fixtures
explicitly enabled and a Traefik network. Disable its `SEED_DEV_DATA` flag for a
non-fixture installation. Docker excludes local databases, `history.csv`, and
exercise-extraction artifacts from its build context.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `80` | Express listening port |
| `DATA_DIR` | `/app/data` | Directory containing `gymapp.db` |
| `SEED_DEV_DATA` | `false` | One-time development fixtures on a fresh installation |
| `COOKIE_SECURE` | `false` | Secure session cookie when served over HTTPS |
| `ADMIN_USERNAME` | unset | Legacy non-fixture bootstrap promotion only |
| `PUBLIC_URL` | detected | Base URL for OIDC callback construction |

## Sync behavior and current limits

Domain IDs are UUIDs; account IDs are non-reused server integers. Each
account/installation pair has a separate IndexedDB database. Explicit commands
carry both identities, a mutation UUID, and expected revision. The server
validates and commits a mutation plus its receipt in one transaction; retries
return the saved result instead of applying the mutation twice.

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

GitHub Actions (`.github/workflows/verify-and-publish.yml`) runs only for
release tags (`latest` or `v*`) and manual `workflow_dispatch` runs; ordinary
commits and pull requests do not start a pipeline, so run the local checks above
before tagging. A tag first runs verification: dependencies and Chromium, then
Vitest, ESLint (including server/shared JavaScript), the production build, and
the Playwright workflows, uploading the report as an artifact when a browser run
fails. Only after that does the publish job build the amd64 and arm64 images and
push them to GHCR, so a failing tag publishes nothing. A final job then creates
or updates the matching GitHub release, taking its body from the `## <tag>`
section of [RELEASE_NOTES.md](RELEASE_NOTES.md) and falling back to a commit
summary when that section is missing. Tags containing a suffix such as `-alpha`
are marked as pre-releases.

To verify a branch without tagging it, start the workflow manually from the
Actions tab (`gh workflow run "Verify and publish Docker image to GHCR" --ref
<branch>`); publishing stays skipped unless the selected ref is a tag.
