# Cloud Computing

A personal task management web app for a university Cloud Computing course.

Users can register, sign in, create, view, update and delete tasks, and filter
tasks by status (pending or completed). Data is stored in MySQL.

## Tech stack

- Backend: NestJS (TypeScript, ESM), TypeORM with explicit migrations
- Frontend: React, Vite and Tailwind CSS, served by the NestJS app in production
- Database: MySQL 8.4
- Auth: JWT (HS256), bcrypt password hashing
- Tooling: pnpm, Vitest, Oxlint, Oxfmt, Docker Compose

## Project structure

```text
src/            NestJS backend (auth, tasks, health, database)
web/            React frontend
test/           End-to-end tests
docs/           API spec, database design, verification records
compose.yaml    MySQL and app services
Dockerfile      Multi-stage production image
```

## Run locally

Requirements: Node.js and pnpm versions from `devEngines` in
[package.json](./package.json), and Docker.

1. Copy `.env.example` to `.env` and replace the placeholder passwords,
   `JWT_SECRET` and `SEED_PASSWORD`.
2. Install dependencies, start MySQL, apply migrations and load sample data:

   ```sh
   pnpm install --frozen-lockfile
   docker compose up -d --wait database
   pnpm db:migrate
   pnpm db:seed
   ```

3. Start the app:

   ```sh
   pnpm build
   pnpm start
   ```

   Open <http://localhost:3000>.

For development, run `pnpm dev` (backend with watch mode, port 3000) and
`pnpm dev:web` (frontend on <http://localhost:5173>, proxying `/api` and
`/health` to the backend).

## Run with Docker

```sh
docker build -t cloud-computing:1.0.0 .
docker compose up -d
docker compose exec app node dist/database/migrate.js up
docker compose exec app node dist/database/seed.js
curl http://localhost:3000/health
```

`docker compose down` stops the services and keeps the database volume.
`docker compose down --volumes` also deletes the data.

## Configuration

Sample values are in [.env.example](./.env.example). The app loads `.env` from
the project root; variables already set in the environment take precedence.

| Variable                       | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `PORT`                         | HTTP port (default `3000`)                  |
| `MYSQL_HOST`, `MYSQL_PORT`     | Database host and port                      |
| `MYSQL_DATABASE`               | Database name                               |
| `MYSQL_USER`, `MYSQL_PASSWORD` | Application database account                |
| `MYSQL_ROOT_PASSWORD`          | Used only to initialize the MySQL container |
| `JWT_SECRET`                   | Token signing key (required)                |
| `JWT_EXPIRES_IN`               | Token lifetime in seconds (default `3600`)  |
| `SEED_PASSWORD`                | Password for sample accounts, 8–72 bytes    |

Never commit `.env` files or real credentials.

## API

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`
- `GET|POST /api/v1/tasks`, `GET|PATCH|DELETE /api/v1/tasks/:id` (requires a
  bearer token)
- `GET /health`: returns `200` when the database is reachable, `503` otherwise

Full contract: [docs/api-spec.md](./docs/api-spec.md).

## Database

The schema is defined in [docs/database-design.md](./docs/database-design.md)
and created by migrations in `src/database/migrations/`. Schema synchronization
is disabled and the app does not run migrations on startup.

| Command           | Purpose                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `pnpm db:migrate` | Apply pending migrations                                                                    |
| `pnpm db:revert`  | Revert the latest migration (may delete data)                                               |
| `pnpm db:seed`    | Create sample accounts `alice.seed@example.test` and `bob.seed@example.test`; safe to rerun |

The MySQL server must use UTC (`default-time-zone='+00:00'`); the Compose service
already does.

## Tests and checks

| Command             | Purpose                     |
| ------------------- | --------------------------- |
| `pnpm test`         | Unit and frontend tests     |
| `pnpm test:e2e`     | End-to-end tests with MySQL |
| `pnpm lint`         | Type-aware lint             |
| `pnpm format:check` | Check formatting            |

End-to-end tests need a separate, empty database whose name ends in `_test`.
Create `.env.test` from `.env.example` with that database name and a free port,
then run:

```sh
docker compose -p cloud-db-test --env-file .env.test up -d --wait database
pnpm exec node --env-file=.env.test node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts
docker compose -p cloud-db-test --env-file .env.test down --volumes
```

## Logs

The app logs to stdout. With Docker Compose: `docker compose logs -f app`.

## Contributing

Work items are tracked in the **Điện toán đám mây** project on Plane. Read
[AGENTS.md](./AGENTS.md) for the workflow, branch naming and review rules.
