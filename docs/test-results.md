# Test Results (CLOUD-8, CLOUD-9, CLOUD-10 & CLOUD-11)

## Environment Note

- Verified locally on macOS (Node.js `v24.22.1`, pnpm `12.16.1`).
- HTTP and unit suites exercised the full NestJS HTTP stack (`configureHttpApp`, Express body parser, `ApiRequestMiddleware`, `AuthGuard`, `AuthController`, `TasksController`, `ApiExceptionFilter`) against in-memory repository doubles (`InMemoryAuthRepo`, `InMemoryTasksRepo`) because Docker and a local MySQL daemon are not installed on this machine.
- Live MySQL integration assertions for `CLOUD-8` and `CLOUD-9` (including `ER_DUP_ENTRY` `1062`, `ER_NO_REFERENCED_ROW_2` `1452`, `ON UPDATE CURRENT_TIMESTAMP`, and `ORDER BY due_date IS NULL ASC`) have also been added to `test/database.e2e-spec.ts` for execution in environments with Docker/MySQL (`pnpm test:e2e` with `.env.test`).
- React UI unit/component suites (`web/src/auth/auth-ui.spec.tsx`, `web/src/pages/tasks-ui.spec.tsx`) ran in `jsdom` via Vitest with mocked `fetch` responses matching the `/api/v1` specification.

## Authorization Test Matrix (`docs/api-spec.md` section 6.3)

| ID  | Case                                                                                    | Expected                    | Observed Result                                          | Verified By                                                 |
| --- | --------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| A1  | Call `/api/v1/tasks` without token                                                      | `401`                       | PASS (`401 UNAUTHORIZED`)                                | `test/tasks.e2e-spec.ts`                                    |
| A2  | User B calls `GET /api/v1/tasks/{id}` owned by User A                                   | `404`                       | PASS (`404 TASK_NOT_FOUND`)                              | `test/tasks.e2e-spec.ts`                                    |
| A3  | User B calls `PATCH` and `DELETE` on task owned by User A                               | `404`, A's task unchanged   | PASS (`404 TASK_NOT_FOUND`, title verified intact)       | `test/tasks.e2e-spec.ts`                                    |
| A4  | User B calls `GET /api/v1/tasks`                                                        | Excludes User A's tasks     | PASS (returns only User B's task IDs)                    | `test/tasks.e2e-spec.ts`                                    |
| A5  | Create task with `"user_id": 1` in request body                                         | Task assigned to token user | PASS (`user_id` body field ignored; owned by token user) | `test/tasks.e2e-spec.ts`, `src/tasks/tasks.service.spec.ts` |
| A6  | Expired or 1-character tampered JWT token                                               | `401`                       | PASS (`401 UNAUTHORIZED`)                                | `src/auth/jwt.service.spec.ts`, `test/tasks.e2e-spec.ts`    |
| A7  | Valid unexpired token after user deleted from database (`GET /tasks` and `POST /tasks`) | `401` on both, never `500`  | PASS (`401 UNAUTHORIZED` on both `GET` and `POST`)       | `test/tasks.e2e-spec.ts`, `test/database.e2e-spec.ts`       |

## Frontend UI & SPA Hosting Verification (CLOUD-10 & CLOUD-11)

| Work Item | Scope Verified                                                                                                                                                        | Observed Result | Verified By                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------- |
| CLOUD-10  | Validation, `409` duplicate email alert, loading disabled states, Remember-me (`localStorage` vs `sessionStorage`), session expiration (`expires_at` + timer + `401`) | PASS (4 tests)  | `web/src/auth/auth-ui.spec.tsx`   |
| CLOUD-10  | NestJS static SPA fallback hosting vs `/health` and `/api/v1` JSON routes                                                                                             | PASS (1 test)   | `test/spa.e2e-spec.ts`            |
| CLOUD-11  | Sorted task view, create task, inline edit, checkbox toggle, delete confirmation, status filter requests, error toasts & `401` expiry redirect                        | PASS (4 tests)  | `web/src/pages/tasks-ui.spec.tsx` |
