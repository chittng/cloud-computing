# CLOUD-12 / CLOUD-13 integration with CLOUD-6

Verified locally on November 2, 2026 using the CLOUD-6 Compose MySQL service.

- Build, type-aware lint and test TypeScript checks passed.
- Eight configuration unit tests and nine integration/HTTP tests passed.
- `/health` returned 200 using the actual CLOUD-6 DataSource. Separate HTTP tests
  verified 200/503 payloads and that internal connection errors are not exposed.
- The seed used the migrated CLOUD-6 users/tasks tables without schema changes.
  Two users had bcrypt-verifiable passwords and owned sample tasks. Repeating the
  seed preserved IDs, hashes and task counts. Invalid passwords were rejected.
- The existing CLOUD-6 tests still passed: schema, constraints, UTC timestamps,
  migration idempotence, rollback, and application restart persistence.
- The migration/seed commands were also exercised directly against the test database.

All three features use the same environment settings, UTC connection checks and
TypeORM DataSource. No separate pool or schema configuration was introduced.
The Docker-volume persistence evidence remains in `cloud-6-verification.md`.

Production verification for CLOUD-12 remains pending deployment in CLOUD-34.
CLOUD-34 currently mentions PostgreSQL while these approved designs and code use
MySQL; that deployment requirement must be reconciled by its owner.
