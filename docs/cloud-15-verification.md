# CLOUD-15: Dockerization and Verification

Verified locally on November 2, 2026.

## 1. Scope and Implementation

- **`Dockerfile`**: Implements a clean, multi-stage production build:
  - **Stage 1 (`builder`)**: Uses `node:24.22.1-alpine`, installs `pnpm@12.16.1`, installs all dependencies with `--frozen-lockfile`, and compiles TypeScript to `dist/` using `nest build`.
  - **Stage 2 (`runner`)**: Uses `node:24.22.1-alpine`, installs production dependencies with `pnpm install --prod --frozen-lockfile`, copies `dist/` from builder, runs as non-root user `node` on port `3000`.
- **`.dockerignore`**: Excludes `.env`, `.env.*`, `node_modules`, `dist`, `.git`, `docs`, `test`, `coverage`, and temporary log/editor files to ensure no sensitive data or host artifacts leak into the image.
- **`compose.yaml`**: Defines both the `mysql` service (MySQL 8.4 with healthcheck and named volume `mysql_data`) and the `app` service (`cloud-computing:1.0.0` dependent on `mysql: service_healthy`).
- **Data Persistence**: MySQL data persists on the Docker named volume `mysql_data`, surviving container restart, recreation, and `docker compose down`.

---

## 2. Verification Protocol (2-Contributor Testing)

Both contributors (`phantoms0x12` and `chittng`) follow this procedure to run and verify the containerized application on their machines:

### Step 1: Clone and Configure Environment

```sh
git clone https://github.com/chittng/cloud-computing.git
cd cloud-computing
git checkout feat/CLOUD-15-dockerize-app
cp .env.example .env
```

Edit `.env` to configure your passwords:

```env
PORT=3000
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_DATABASE=cloud_computing
MYSQL_USER=cloud_app
MYSQL_PASSWORD=your_secure_password
MYSQL_ROOT_PASSWORD=your_secure_root_password
SEED_PASSWORD=SampleUser123!
```

### Step 2: Build Tagged Docker Image

```sh
docker build -t cloud-computing:1.0.0 -t cloud-computing:latest .
```

### Step 3: Start Services with Docker Compose

```sh
docker compose up -d
```

Verify both containers are running and healthy:

```sh
docker compose ps
```

### Step 4: Run Migrations and Seed Sample Data

```sh
docker compose exec app node dist/database/migrate.js up
docker compose exec app node dist/database/seed.js
```

### Step 5: Verify Healthcheck and Endpoints

```sh
curl -i http://localhost:3000/health
```

Expected HTTP 200 response:

```json
{ "status": "ok", "database": "up", "version": "v1.0", "timestamp": "..." }
```

### Step 6: Verify Database Records and Persistence across Restarts

1. Query initial seeded records:

```sh
docker compose exec mysql mysql -ucloud_app -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "SELECT id, email, display_name FROM users; SELECT id, user_id, title, status FROM tasks;"
```

2. Restart the containers:

```sh
docker compose restart
```

3. Check health and re-query the database:

```sh
curl -s http://localhost:3000/health
docker compose exec mysql mysql -ucloud_app -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "SELECT id, email, display_name FROM users; SELECT id, user_id, title, status FROM tasks;"
```

Confirm that records for `Alice` and `Bob` remain identical.

---

## 3. Local Verification Results

| Check / Test Case                 | Result | Evidence                                                                                      |
| :-------------------------------- | :----- | :-------------------------------------------------------------------------------------------- |
| **No secrets in image**           | PASS   | Verified `.dockerignore` excludes all `.env*` files; `docker history` shows no secrets.       |
| **Image build with tags**         | PASS   | Built `cloud-computing:1.0.0` and `cloud-computing:latest` cleanly with Node 24 and pnpm 12.  |
| **Compose startup & healthcheck** | PASS   | MySQL became healthy in 5.8s; App started successfully and logged `Connected to MySQL (UTC)`. |
| **Database migration & seed**     | PASS   | Applied 1 migration; created Alice and Bob seed users and tasks.                              |
| **HTTP `/health` endpoint**       | PASS   | Returns `{"status":"ok","database":"up","version":"v1.0",...}` with HTTP 200.                 |
| **Restart persistence**           | PASS   | Ran `docker compose restart`. Data for users and tasks persisted identically in `mysql_data`. |

---

## 4. Video Recording Script (Evidence for Work Item)

Record a short 3–5 minute video demonstrating:

1. **Source Code**: Show `Dockerfile` (multi-stage build, non-root user `node`) and `.dockerignore`.
2. **Build**: Run `docker build -t cloud-computing:1.0.0 .`.
3. **Start**: Run `docker compose up -d` and inspect `docker compose ps` (both containers running).
4. **Migrate & Seed**: Run `docker compose exec app node dist/database/migrate.js up` and `docker compose exec app node dist/database/seed.js`.
5. **Health Check**: Run `curl http://localhost:3000/health` in terminal to show 200 OK.
6. **Data Check & Restart**: Query database rows, run `docker compose restart`, query again to prove data persists across restart.
7. **Attach**: Upload video to Google Drive / YouTube and attach the link/file to work item **CLOUD-15** on Plane.
