# Cloud Computing

A personal task management web application for a university Cloud Computing course.
The course project covers application development, Docker packaging, and cloud
deployment and operation.

## Project scope

The planned application lets users register, sign in, create and view tasks, edit
their title, description, deadline, or status, delete tasks, and filter tasks by
completion status. Task data will be stored in a database.

The repository contains the NestJS backend, MySQL integration, versioned database
migrations, and development tooling. Application features, the web interface,
a health endpoint, application Docker packaging, and cloud deployment are planned work.

## Technology and structure

- Backend: NestJS with TypeScript and native ESM.
- Package manager: pnpm.
- Code quality: Oxlint and Oxfmt.
- Testing: Vitest, with Supertest available for HTTP tests.
- Database: MySQL with TypeORM and mysql2. Schema changes use explicit migrations;
  automatic schema synchronization is disabled.

```text
src/
  main.ts          Application entry point
  root.module.ts   Root NestJS module
  database/        Connection configuration and versioned migrations
test/              MySQL integration tests
compose.yaml       Local MySQL service and persistent named volume
AGENTS.md          Contributor and AI agent instructions
CLAUDE.md          Entry point to the shared instructions for Claude
```

## Local development

Use the Node.js and pnpm versions specified in `devEngines` in
[package.json](./package.json). Dependency pinning settings are in
[pnpm-workspace.yaml](./pnpm-workspace.yaml).

Install dependencies, copy `.env.example` to `.env`, and replace both password
placeholders with local passwords. In PowerShell use `Copy-Item .env.example .env`;
in a POSIX shell use `cp .env.example .env`. Then start MySQL, apply migrations,
and start the development server:

```sh
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

The server listens on port `3000` by default. Stop it with `Ctrl+C`.
On Windows with Docker installed only in WSL, run Docker commands as
`wsl -d Ubuntu-24.04 -- docker compose ...` from the project directory.

To build and run the compiled application locally:

```sh
pnpm build
pnpm start
```

`GET /health` is public and probes the same MySQL connection pool used by the app.
It returns `200` with `status: "ok"` and `database: "up"`, or `503` with
`status: "error"` and `database: "down"` when the query fails. Both responses include
`version` and a UTC `timestamp`; connection details are never returned.
Requests to `/` currently return `404`. Production verification awaits CLOUD-34.

## Configuration and logs

| Environment variable | Purpose             | Default |
| -------------------- | ------------------- | ------- |
| `PORT`               | HTTP listening port | `3000`  |

Set environment variables in the shell or runtime environment before starting the
application. The backend and migration runner also load `.env` from the project
directory; existing environment variables take precedence. Startup logs include
`Connected to MySQL (UTC)` after the connection is verified. Shutdown closes the
connection pool.

MySQL variables and local values are listed in [.env.example](./.env.example):
`MYSQL_HOST` and `MYSQL_PORT` select the host connection; `MYSQL_DATABASE`,
`MYSQL_USER`, and `MYSQL_PASSWORD` are required. `MYSQL_ROOT_PASSWORD` is used only
to initialize the Docker database, not by the application. The application uses
the dedicated database user.

The Compose service defines its MySQL image, character set, collation, UTC server
time zone, health check, localhost port binding, and named volume in
[compose.yaml](./compose.yaml). For an external server, configure
`default-time-zone='+00:00'`; startup rejects other global/session time zones.
The driver reads/writes `DATETIME` as UTC. Raw `BIGINT` results are strings to avoid
precision loss; future API serializers must validate the safe integer range before
converting IDs to JSON numbers. `DATE` results remain date-only strings.

Keep real credentials and `.env` files out of Git. Changing Docker initialization
credentials in `.env` does not change users in an existing database volume.

## Database migrations

The initial migration implements the schema in
[docs/database-design.md](./docs/database-design.md). Run from the repository root:

```sh
pnpm db:migrate
```

The command builds the ESM application and applies pending migrations to the
configured, already-created database. TypeORM records applied migrations in its
`migrations` table. Running it again without new migrations makes no schema changes.
Application startup does not automatically apply migrations. Run one migration
process at a time before starting a new application version.

To revert the latest migration in a disposable local database:

```sh
pnpm db:revert
```

The initial migration's rollback drops `tasks` before `users` and deletes their
data. MySQL DDL is not transactional; if a migration fails partway, inspect the
schema before retrying. Do not use rollback or delete a volume containing data
you need to keep.

## Verify database integration and persistence

Use a separate disposable database for the integration suite. Copy `.env.example`
to `.env.test`, choose different passwords, set `MYSQL_DATABASE` to a name ending
in `_test`, and set `MYSQL_PORT` to an unused port. Do not migrate this test database
first: the suite verifies migration from an empty database, repeat execution,
constraints, indexes, UTC timestamps, rollback, Nest DI, pool cleanup, and data
survival across application restarts.

```sh
docker compose -p cloud-db-test --env-file .env.test up -d --wait
pnpm exec node --env-file=.env.test node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts
docker compose -p cloud-db-test --env-file .env.test down
```

The suite uses only a database whose name ends in `_test`, and its rollback removes
the application tables afterward. The normal `pnpm test:e2e` command also works
when the same test variables are supplied in the shell environment.

To demonstrate Docker volume persistence with the local development database,
apply migrations, start the app, then open a MySQL session:

```sh
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --user="$MYSQL_USER" "$MYSQL_DATABASE"'
```

Insert a recognizable user and task, then exit the MySQL session:

```sql
INSERT INTO users (email, password_hash) VALUES ('persistence@example.com', 'test-only-hash');
INSERT INTO tasks (user_id, title)
SELECT id, 'Volume persistence check' FROM users WHERE email = 'persistence@example.com';
exit
```

Stop the application, recreate the MySQL container, then restart the application:

```sh
docker compose up -d --force-recreate --wait
pnpm start
```

Open the same MySQL session again and confirm the task still exists:

```sql
SELECT tasks.id, tasks.title FROM tasks
JOIN users ON users.id = tasks.user_id WHERE users.email = 'persistence@example.com';
DELETE FROM users WHERE email = 'persistence@example.com';
```

The named volume survives container recreation and `docker compose down`.
`docker compose down --volumes` deletes that stored database. Verification evidence
for CLOUD-6 is recorded in [docs/cloud-6-verification.md](./docs/cloud-6-verification.md).

## Development commands

| Command             | Purpose                                 |
| ------------------- | --------------------------------------- |
| `pnpm format`       | Format files with Oxfmt                 |
| `pnpm format:check` | Check formatting without changing files |
| `pnpm lint`         | Run type-aware Oxlint checks            |
| `pnpm lint:fix`     | Apply automatic lint fixes              |
| `pnpm test`         | Run unit tests                          |
| `pnpm test:e2e`     | Run end-to-end tests                    |
| `pnpm test:cov`     | Run tests with coverage                 |

Unit tests use `*.spec.ts`; end-to-end tests use `*.e2e-spec.ts`. Their suite
configuration is defined in `vitest.config.ts` and `vitest.config.e2e.ts`.

## Collaboration

Work items and assignments are managed in the **Điện toán đám mây** project on
Plane.so. Source code is hosted on [GitHub](https://github.com/chittng/cloud-computing).
Read [AGENTS.md](./AGENTS.md) for the shared workflow, branch naming convention,
completion checklists, and review process.
