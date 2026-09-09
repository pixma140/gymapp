# Phase B server checkpoint

Historical snapshot from 2026-09-08. Client work described below as forthcoming
has since landed; see [ARCHITECTURE.md](../ARCHITECTURE.md) for current status.

The fresh SQLite schema is now in `server/schema.js`: shared UUID gyms,
private UUID workouts/measurements, cascading account/session/receipt cleanup,
non-reused integer account IDs, revisions, and account/catalog generations.
Schema changes assume fresh databases under the [alpha database policy](../README.md#alpha-database-policy-and-reset).

`SEED_DEV_DATA=true` creates the environment-configured administrator and regular
account plus two stable shared gyms on a fresh installation. The seed completion marker and
initialization mode prevent subsequent password/role/name repairs or fixture
recreation. Non-fixture initialization keeps first-admin setup and registration.

Stop the server before resetting. Run `DATA_DIR=./db node server/reset.js --seed`
for fixtures, or omit `--seed` for empty setup. The server/reset lease guards
cooperating processes. Reset removes only gymapp.db and its WAL/SHM companions,
then creates a new installation identity. No source export is imported/deleted.
The repository's development database was checked for open handles and explicitly
reset/seeded on 2026-09-08.

The old arbitrary-table API is replaced by the explicit command contract in
`shared/commands.js` and a consistent account snapshot. Commands check identity,
permissions, ownership, revisions, active-session rules, and payload values;
receipts and mutations commit together. HTTP tests cover these replacement
paths. Client consumption and browser smoke tests follow in the next commit.
