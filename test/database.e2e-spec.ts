import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseOptions } from "../src/database/database-options.ts";
import { connectDatabase } from "../src/database/data-source.ts";
import { RootModule } from "../src/root.module.ts";
import { seedData } from "../src/database/seed-data.ts";
import { compare } from "bcryptjs";
import request from "supertest";

describe("MySQL integration (dedicated disposable *_test database)", () => {
  let source: DataSource;
  let app: INestApplicationContext | undefined;
  let migrated = 0;

  beforeAll(async () => {
    if (!process.env.MYSQL_DATABASE?.endsWith("_test")) {
      throw new Error("Use a dedicated empty MYSQL_DATABASE ending in _test; see README");
    }
    source = await connectDatabase(databaseOptions());
    const tables = await source.query<{ TABLE_NAME: string }[]>(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'tasks')",
    );
    expect(tables).toEqual([]);
    const applied = await source.runMigrations();
    migrated = applied.length;
    expect(applied).toHaveLength(3);
  });

  afterAll(async () => {
    await app?.close();
    if (source?.isInitialized) {
      try {
        if (migrated) {
          while (migrated > 0) {
            await source.undoLastMigration();
            migrated--;
          }
          const tables = await source.query<unknown[]>(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'tasks')",
          );
          expect(tables).toEqual([]);
        }
      } finally {
        await source.destroy();
      }
    }
  });

  it("records migrations and does not reapply them", async () => {
    expect(await source.runMigrations()).toEqual([]);
  });

  it("seeds two users with valid hashes and owned tasks without overwriting on rerun", async () => {
    await seedData(source, "Test-only-password");
    const first = await source.query<{ id: string; email: string; password: string }[]>(
      "SELECT id, email, password FROM users WHERE email IN ('alice.seed@example.test', 'bob.seed@example.test') ORDER BY email",
    );
    expect(first).toHaveLength(2);
    for (const user of first) expect(await compare("Test-only-password", user.password)).toBe(true);
    await seedData(source, "Different-password");
    expect(
      await source.query(
        "SELECT id, email, password FROM users WHERE email IN ('alice.seed@example.test', 'bob.seed@example.test') ORDER BY email",
      ),
    ).toEqual(first);
    const tasks = await source.query<{ title: string }[]>(
      "SELECT title FROM tasks JOIN users ON users.id = tasks.user_id WHERE email IN ('alice.seed@example.test', 'bob.seed@example.test')",
    );
    expect(tasks).toHaveLength(2);
    await expect(seedData(source, "short")).rejects.toThrow("SEED_PASSWORD");
  });

  it("serves a healthy HTTP response through the real CLOUD-6 data source", async () => {
    const http = await NestFactory.create(RootModule, { logger: false });
    try {
      await http.init();
      const response = await request(http.getHttpServer()).get("/health").expect(200);
      expect(response.body.database).toBe("up");
    } finally {
      await http.close();
    }
  });

  it("renames the password column without changing stored hashes and supports rollback", async () => {
    await source.undoLastMigration();
    migrated--;
    await source.query(
      "INSERT INTO users (email, password_hash) VALUES ('rename@example.com', 'existing-hash')",
    );
    const applied = await source.runMigrations();
    migrated += applied.length;
    expect(applied).toHaveLength(1);
    expect(
      await source.query("SELECT password FROM users WHERE email = 'rename@example.com'"),
    ).toEqual([{ password: "existing-hash" }]);
    await source.undoLastMigration();
    migrated--;
    expect(
      await source.query("SELECT password_hash FROM users WHERE email = 'rename@example.com'"),
    ).toEqual([{ password_hash: "existing-hash" }]);
    const reapplied = await source.runMigrations();
    migrated += reapplied.length;
    expect(reapplied).toHaveLength(1);
    await source.query("DELETE FROM users WHERE email = 'rename@example.com'");
  });

  it("upgrades existing data to unicode collation and supports rollback", async () => {
    await source.undoLastMigration();
    migrated--;
    await source.undoLastMigration();
    migrated--;
    const [previous] = await source.query<{ TABLE_COLLATION: string }[]>(
      "SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
    );
    expect(previous?.TABLE_COLLATION).toBe("utf8mb4_0900_ai_ci");
    await source.query(
      "INSERT INTO users (email, password_hash, display_name) VALUES ('collation@example.com', 'hash', 'Nguyễn 🌤️')",
    );
    await source.query(
      "INSERT INTO tasks (user_id, title, description) SELECT id, 'Điện toán ☁️', 'Tiếng Việt' FROM users WHERE email = 'collation@example.com'",
    );
    const applied = await source.runMigrations();
    migrated += applied.length;
    expect(applied).toHaveLength(2);
    const [database] = await source.query<{ collation: string; connection_collation: string }[]>(
      "SELECT @@collation_database AS collation, @@collation_connection AS connection_collation",
    );
    expect(database).toEqual({
      collation: "utf8mb4_unicode_ci",
      connection_collation: "utf8mb4_unicode_ci",
    });
    const tables = await source.query<{ TABLE_COLLATION: string }[]>(
      "SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'tasks')",
    );
    expect(tables).toHaveLength(2);
    expect(tables.every((table) => table.TABLE_COLLATION === "utf8mb4_unicode_ci")).toBe(true);
    expect(
      await source.query(
        "SELECT display_name, title, description FROM users JOIN tasks ON tasks.user_id = users.id WHERE email = 'collation@example.com'",
      ),
    ).toEqual([{ display_name: "Nguyễn 🌤️", title: "Điện toán ☁️", description: "Tiếng Việt" }]);
    await expect(
      source.query("INSERT INTO users (email, password) VALUES ('collation@example.com ', 'hash')"),
    ).rejects.toMatchObject({ driverError: { code: "ER_DUP_ENTRY" } });
    await source.undoLastMigration();
    migrated--;
    await source.undoLastMigration();
    migrated--;
    expect(
      await source.query(
        "SELECT display_name, title, description FROM users JOIN tasks ON tasks.user_id = users.id WHERE email = 'collation@example.com'",
      ),
    ).toEqual([{ display_name: "Nguyễn 🌤️", title: "Điện toán ☁️", description: "Tiếng Việt" }]);
    const reapplied = await source.runMigrations();
    migrated += reapplied.length;
    expect(reapplied).toHaveLength(2);
    await source.query("DELETE FROM users WHERE email = 'collation@example.com'");
  });

  it("creates the designed columns, constraints and indexes", async () => {
    const columns = await source.query<
      {
        TABLE_NAME: string;
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
        EXTRA: string;
        COLLATION_NAME: string | null;
      }[]
    >(
      "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'tasks')",
    );
    expect(columns).toHaveLength(14);
    expect(columns).toContainEqual(
      expect.objectContaining({
        TABLE_NAME: "users",
        COLUMN_NAME: "password",
        DATA_TYPE: "varchar",
        IS_NULLABLE: "NO",
        COLLATION_NAME: "utf8mb4_unicode_ci",
      }),
    );
    expect(columns.some((column) => column.COLUMN_NAME === "password_hash")).toBe(false);
    for (const column of columns.filter((column) => column.COLLATION_NAME !== null)) {
      expect(column.COLLATION_NAME).toBe(
        column.COLUMN_NAME === "status" ? "utf8mb4_bin" : "utf8mb4_unicode_ci",
      );
    }
    for (const table of ["users", "tasks"]) {
      expect(columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            TABLE_NAME: table,
            COLUMN_NAME: "id",
            DATA_TYPE: "bigint",
            EXTRA: "auto_increment",
          }),
          expect.objectContaining({
            TABLE_NAME: table,
            COLUMN_NAME: "created_at",
            DATA_TYPE: "datetime",
            IS_NULLABLE: "NO",
          }),
          expect.objectContaining({
            TABLE_NAME: table,
            COLUMN_NAME: "updated_at",
            DATA_TYPE: "datetime",
            EXTRA: expect.stringContaining("on update CURRENT_TIMESTAMP"),
          }),
        ]),
      );
    }
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          COLUMN_NAME: "status",
          COLUMN_DEFAULT: "pending",
          IS_NULLABLE: "NO",
        }),
        expect.objectContaining({ COLUMN_NAME: "due_date", DATA_TYPE: "date", IS_NULLABLE: "YES" }),
        expect.objectContaining({
          COLUMN_NAME: "description",
          DATA_TYPE: "text",
          IS_NULLABLE: "YES",
        }),
        expect.objectContaining({ COLUMN_NAME: "display_name", IS_NULLABLE: "YES" }),
      ]),
    );
    const indexes = await source.query<{ INDEX_NAME: string; columns_list: string }[]>(
      "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_list FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' GROUP BY INDEX_NAME",
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        { INDEX_NAME: "PRIMARY", columns_list: "id" },
        { INDEX_NAME: "idx_tasks_user_status_due", columns_list: "user_id,status,due_date" },
        { INDEX_NAME: "idx_tasks_user_due", columns_list: "user_id,due_date" },
      ]),
    );
  });

  it("enforces unique email, foreign keys, valid status/title and cascade deletion", async () => {
    await source.query(
      "INSERT INTO users (email, password) VALUES ('an@example.com', 'test-hash')",
    );
    const [user] = await source.query<{ id: string }[]>(
      "SELECT id FROM users WHERE email = 'an@example.com'",
    );
    expect(user).toBeDefined();
    const id = user!.id;
    await expect(
      source.query("INSERT INTO users (email, password) VALUES ('AN@example.com', 'hash')"),
    ).rejects.toMatchObject({ driverError: { code: "ER_DUP_ENTRY" } });
    for (const status of ["PENDING", "invalid"]) {
      await expect(
        source.query("INSERT INTO tasks (user_id, title, status) VALUES (?, ?, ?)", [
          id,
          "Task",
          status,
        ]),
      ).rejects.toMatchObject({ driverError: { code: "ER_CHECK_CONSTRAINT_VIOLATED" } });
    }
    await expect(
      source.query("INSERT INTO tasks (user_id, title) VALUES (?, '   ')", [id]),
    ).rejects.toMatchObject({ driverError: { code: "ER_CHECK_CONSTRAINT_VIOLATED" } });
    await expect(
      source.query("INSERT INTO tasks (user_id, title) VALUES (-1, 'Orphan')"),
    ).rejects.toMatchObject({ driverError: { code: "ER_NO_REFERENCED_ROW_2" } });
    await source.query("INSERT INTO tasks (user_id, title) VALUES (?, 'Task')", [id]);
    const [task] = await source.query<{ status: string; description: null; due_date: null }[]>(
      "SELECT status, description, due_date FROM tasks WHERE user_id = ?",
      [id],
    );
    expect(task).toEqual({ status: "pending", description: null, due_date: null });
    await source.query("DELETE FROM users WHERE id = ?", [id]);
    expect(await source.query("SELECT id FROM tasks WHERE user_id = ?", [id])).toEqual([]);
  });

  it("keeps UTC timestamps and updates updated_at when data changes", async () => {
    await source.query(
      "INSERT INTO users (email, password, updated_at) VALUES ('time@example.com', 'hash', '2000-01-01 00:00:00')",
    );
    await source.query(
      "UPDATE users SET display_name = 'Updated' WHERE email = 'time@example.com'",
    );
    const [row] = await source.query<{ updated_at: Date; utc_difference: string }[]>(
      "SELECT updated_at, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), updated_at) AS utc_difference FROM users WHERE email = 'time@example.com'",
    );
    expect(row?.updated_at).toBeInstanceOf(Date);
    expect(row?.utc_difference).toBe("0");
    const previous = row!.updated_at;
    await source.query(
      "UPDATE users SET display_name = 'Updated' WHERE email = 'time@example.com'",
    );
    const [unchanged] = await source.query<{ updated_at: Date }[]>(
      "SELECT updated_at FROM users WHERE email = 'time@example.com'",
    );
    expect(unchanged?.updated_at).toEqual(previous);
  });

  it("connects through Nest DI and retains data after restarting the application", async () => {
    app = await NestFactory.createApplicationContext(RootModule, { logger: false });
    const first = app.get(DataSource);
    await first.query("INSERT INTO users (email, password) VALUES ('restart@example.com', 'hash')");
    await first.query(
      "INSERT INTO tasks (user_id, title) SELECT id, 'Persistent task' FROM users WHERE email = 'restart@example.com'",
    );
    await app.close();
    expect(first.isInitialized).toBe(false);
    app = await NestFactory.createApplicationContext(RootModule, { logger: false });
    const second = app.get(DataSource);
    expect(
      await second.query(
        "SELECT title FROM tasks JOIN users ON users.id = tasks.user_id WHERE email = 'restart@example.com'",
      ),
    ).toEqual([{ title: "Persistent task" }]);
  });
});
