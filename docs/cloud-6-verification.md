# CLOUD-6 verification

Verified locally on November 2, 2026 against MySQL 8.4.11 in Docker through
Ubuntu 24.04 WSL. The application used the Node.js/pnpm versions required by
`package.json`. No production or shared database was used.

## Checks

- `pnpm build`: passed, including the compiled ESM migration runner.
- `pnpm lint`: passed.
- `pnpm exec tsc --project tsconfig.test.json --noEmit`: passed.
- `pnpm test`: 8 unit tests passed (configuration validation).
- MySQL integration suite: 5 tests passed. It applies the initial migration to an
  empty test database, verifies repeat migration execution is a no-op, checks schema
  and indexes, tests unique email/FK/CHECK/CASCADE behavior, validates UTC timestamps
  and `updated_at`, and restarts the Nest application context to check persistence
  and pool cleanup. Teardown verifies rollback removes both application tables.
- `pnpm db:migrate` after suite teardown: applied 1 migration; a second invocation
  applied 0 migrations.
- Formatting checks for changed source, tests, configuration and documentation:
  passed. Repository-wide `pnpm format:check` still reports pre-existing differences
  in `docs/api-spec.md`, `docs/database-design.md`, `tsconfig.test.json`,
  `vitest.config.ts`, and `vitest.config.e2e.ts`; these files were not modified.

See the README for commands to run the suite with a dedicated empty test database.

## Container recreation and named-volume persistence

Used the isolated Compose project `cloud6-verification`, with credentials in an
ignored local environment file. Through a compiled Nest application context and
its injected TypeORM `DataSource`:

1. Inserted a user and one task, then closed the application context/pool.
2. Confirmed MySQL reported both global and session time zones as `+00:00`.
3. Recreated the MySQL container using Compose's `--force-recreate --wait`.
4. Started a new compiled Nest application context and read back the same row.

| Evidence                           | Before recreation                | After recreation                 |
| ---------------------------------- | -------------------------------- | -------------------------------- |
| Container ID (prefix)              | `29697a22c127`                   | `813bcd855039`                   |
| Volume mounted at `/var/lib/mysql` | `cloud6-verification_mysql_data` | `cloud6-verification_mysql_data` |
| Task ID (raw BIGINT string)        | `1`                              | `1`                              |
| Task title                         | `CLOUD-6 persistent task`        | `CLOUD-6 persistent task`        |

The compiled application logged `Connected to MySQL (UTC)` before both reads. The
changed container ID and unchanged named volume/data demonstrate persistence
independently of the old application's process or connection pool.
