# Cloud Computing

A personal task management web app for a university Cloud Computing course.

Users can register, sign in, create, view, update and delete tasks, and filter
tasks by status (pending or completed). Data is stored in MySQL.

## Tech stack

- Backend: NestJS (TypeScript, ESM), TypeORM with explicit migrations,
  class-validator DTOs, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/terminus`
- Frontend: React, Vite, Tailwind CSS and shadcn/ui, with React Router,
  TanStack Query, React Hook Form and Zod; served by the NestJS app in production
- Database: MySQL 8.4
- Auth: JWT bearer tokens, bcrypt password hashing
- Tooling: pnpm, Vitest, Oxlint, Oxfmt, Docker Compose

## Project structure

The repository is a pnpm workspace; packages are listed in
[pnpm-workspace.yaml](./pnpm-workspace.yaml).

```text
apps/api/       NestJS backend (@cloud-computing/api)
  src/          One module per feature: auth, users, tasks, health; database
  test/         End-to-end tests
apps/web/       React frontend (@cloud-computing/web)
  src/features/ Pages, API calls and hooks per feature: auth, tasks
  src/components/ui/  shadcn/ui components
docs/           Earlier design notes and verification records
compose.yaml    MySQL, migration and app services
Dockerfile      Multi-stage production image
```

Scripts in the root `package.json` run the matching script in each app. To run
any other script in one app, use `pnpm --filter <package name> <script>`.

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
docker compose up -d --build --wait
docker compose exec app node dist/database/seed.js   # optional sample data
curl http://localhost:3000/health
```

`up` builds the `cloud-computing:1.0.0` image and starts three services:

- `database`: MySQL, reachable from the host only on `127.0.0.1:${MYSQL_PORT}`.
- `migrate`: applies pending migrations once MySQL is healthy, then exits.
- `app`: starts after `migrate` succeeds and listens on `${PORT}` (default `3000`).
  Its health check calls `/health`, so `--wait` returns once the app and the
  database both answer.

Run the same `up` command to deploy a new version; migrations run before the
new app container starts. If `migrate` fails, `app` does not start; read the
error with `docker compose logs migrate`. The seed command needs
`SEED_PASSWORD` in `.env`.

`database` and `app` restart automatically when they crash or the Docker daemon
restarts. `docker compose down` stops the services and keeps the database volume.
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

| Endpoint                                   | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `POST /api/auth/register`                  | Create an account                                    |
| `POST /api/auth/login`                     | Returns `accessToken`, `expiresIn` and the user      |
| `GET /api/tasks?status=pending\|completed` | List your tasks by due date, undated tasks last      |
| `POST /api/tasks`                          | Create a task                                        |
| `GET\|PATCH\|DELETE /api/tasks/:id`        | Read, update or delete one of your tasks             |
| `GET /health`                              | `200` when the database answers a ping, `503` if not |

Every `/api/tasks` route requires an `Authorization: Bearer <accessToken>`
header. Request bodies are validated by the DTOs in `apps/api/src/*/dto/`;
errors use the standard NestJS shape `{ statusCode, message, error }`.

## Database

The schema is created by migrations in `apps/api/src/database/migrations/`
and mapped by the TypeORM entities. Schema synchronization is disabled and the
app does not run migrations on startup; locally run `pnpm db:migrate`, and with
Docker Compose the `migrate` service runs them.

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
| `pnpm test`         | Unit tests in both apps     |
| `pnpm test:e2e`     | End-to-end tests with MySQL |
| `pnpm lint`         | Type-aware lint             |
| `pnpm format:check` | Check formatting            |

End-to-end tests run against a separate database whose name ends in `_test`;
they delete all of its data. Create `.env.test` from `.env.example` with that
database name and a free `MYSQL_PORT`, then run:

```sh
docker compose -p cloud-db-test --env-file .env.test up -d --wait database
pnpm test:e2e
docker compose -p cloud-db-test --env-file .env.test down --volumes
```

`pnpm test:e2e` reads `.env.test` on top of `.env` and applies the migrations itself.

## Logs

The app logs to stdout. With Docker Compose: `docker compose logs -f app`.

## Contributing

Work items are tracked in the **Điện toán đám mây** project on Plane. Read
[AGENTS.md](./AGENTS.md) for the workflow, branch naming and review rules.
