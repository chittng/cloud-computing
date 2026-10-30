# Cloud Computing

A personal task management web application for a university Cloud Computing course.
The course project covers application development, Docker packaging, and cloud
deployment and operation.

## Project scope

The planned application lets users register, sign in, create and view tasks, edit
their title, description, deadline, or status, delete tasks, and filter tasks by
completion status. Task data will be stored in a database.

The repository currently contains the initial NestJS backend and development
tooling. Application features, the web interface, database integration, a health
endpoint, Docker packaging, and cloud deployment are planned work.

## Technology and structure

- Backend: NestJS with TypeScript and native ESM.
- Package manager: pnpm.
- Code quality: Oxlint and Oxfmt.
- Testing: Vitest, with Supertest available for HTTP tests.

```text
src/
  main.ts          Application entry point
  root.module.ts   Root NestJS module
AGENTS.md          Contributor and AI agent instructions
CLAUDE.md          Entry point to the shared instructions for Claude
```

## Local development

Use the Node.js and pnpm versions specified in `devEngines` in
[package.json](./package.json). Dependency pinning settings are in
[pnpm-workspace.yaml](./pnpm-workspace.yaml).

Install dependencies and start the development server:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The server listens on port `3000` by default. Stop it with `Ctrl+C`.

To build and run the compiled application locally:

```sh
pnpm build
pnpm start
```

The initial module has no HTTP routes. Requests to `/` currently return `404`;
`/health` will be added in a later work item.

## Configuration and logs

| Environment variable | Purpose             | Default |
| -------------------- | ------------------- | ------- |
| `PORT`               | HTTP listening port | `3000`  |

Set environment variables in the shell or runtime environment before starting the
application. Startup logs are printed to the terminal running the server.

Document additional variables and provide `.env.example` as integrations are added.
Keep real credentials, access keys, private keys, and `.env` files out of Git.

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
