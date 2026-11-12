import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.ts";

// These tests delete all users and tasks, so refuse to run against a non-test database.
if (!process.env.MYSQL_DATABASE?.endsWith("_test")) {
  throw new Error("E2E tests need MYSQL_DATABASE to end with _test");
}

let app: INestApplication;
let http: ReturnType<typeof request>;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.get(DataSource).runMigrations();
  http = request(app.getHttpServer());
});

beforeEach(async () => {
  const dataSource = app.get(DataSource);
  await dataSource.query("DELETE FROM tasks");
  await dataSource.query("DELETE FROM users");
});

afterAll(async () => {
  await app?.close();
});

async function signUp(email: string): Promise<string> {
  await http.post("/api/auth/register").send({ email, password: "password123" }).expect(201);
  const login = await http.post("/api/auth/login").send({ email, password: "password123" });
  return login.body.accessToken as string;
}

describe("GET /health", () => {
  it("reports the database as up", async () => {
    const response = await http.get("/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok", info: { database: { status: "up" } } });
  });
});

describe("auth", () => {
  it("registers with a normalized email and never returns the password", async () => {
    const response = await http
      .post("/api/auth/register")
      .send({ email: " Alice@Example.TEST ", password: "password123", displayName: " Alice " })
      .expect(201);

    expect(response.body).toMatchObject({ email: "alice@example.test", displayName: "Alice" });
    expect(response.body).not.toHaveProperty("password");
  });

  it("rejects a duplicate email with 409", async () => {
    await signUp("alice@example.test");
    await http
      .post("/api/auth/register")
      .send({ email: "ALICE@example.test", password: "password123" })
      .expect(409);
  });

  it("rejects invalid input and unknown fields with 400", async () => {
    const response = await http
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "short", role: "admin" })
      .expect(400);

    expect(response.body.message).toHaveLength(3);
  });

  it("logs in and returns a token with the user profile", async () => {
    await signUp("alice@example.test");
    const response = await http
      .post("/api/auth/login")
      .send({ email: "alice@example.test", password: "password123" })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: { email: "alice@example.test", displayName: null },
    });
  });

  it("rejects a wrong password with 401", async () => {
    await signUp("alice@example.test");
    await http
      .post("/api/auth/login")
      .send({ email: "alice@example.test", password: "wrong-password" })
      .expect(401);
  });
});

describe("tasks", () => {
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    token = await signUp("alice@example.test");
  });

  it("requires a bearer token", async () => {
    await http.get("/api/tasks").expect(401);
    await http.get("/api/tasks").set("Authorization", "Bearer invalid").expect(401);
  });

  it("creates, reads, updates and deletes a task", async () => {
    const created = await http
      .post("/api/tasks")
      .set(auth())
      .send({ title: "  Write report  ", dueDate: "2026-12-01" })
      .expect(201);
    expect(created.body).toMatchObject({
      title: "Write report",
      description: null,
      dueDate: "2026-12-01",
      status: "pending",
    });
    expect(created.body).not.toHaveProperty("userId");
    const path = `/api/tasks/${created.body.id}`;

    await http.get(path).set(auth()).expect(200);

    const updated = await http
      .patch(path)
      .set(auth())
      .send({ status: "completed", dueDate: null })
      .expect(200);
    expect(updated.body).toMatchObject({
      title: "Write report",
      status: "completed",
      dueDate: null,
    });

    await http.delete(path).set(auth()).expect(204);
    await http.get(path).set(auth()).expect(404);
  });

  it("lists tasks by due date with undated tasks last, and filters by status", async () => {
    for (const task of [
      { title: "Undated" },
      { title: "Later", dueDate: "2026-12-31" },
      { title: "Sooner", dueDate: "2026-11-20", status: "completed" },
    ]) {
      await http.post("/api/tasks").set(auth()).send(task).expect(201);
    }

    const all = await http.get("/api/tasks").set(auth()).expect(200);
    expect(all.body.map((task: { title: string }) => task.title)).toEqual([
      "Sooner",
      "Later",
      "Undated",
    ]);

    const completed = await http.get("/api/tasks?status=completed").set(auth()).expect(200);
    expect(completed.body.map((task: { title: string }) => task.title)).toEqual(["Sooner"]);

    await http.get("/api/tasks?status=done").set(auth()).expect(400);
  });

  it("validates task input", async () => {
    await http.post("/api/tasks").set(auth()).send({ title: "   " }).expect(400);
    await http
      .post("/api/tasks")
      .set(auth())
      .send({ title: "Bad date", dueDate: "2026-02-30" })
      .expect(400);
    await http.get("/api/tasks/abc").set(auth()).expect(400);
  });

  it("hides other users' tasks", async () => {
    const created = await http.post("/api/tasks").set(auth()).send({ title: "Private" });
    const otherToken = await signUp("bob@example.test");
    const other = { Authorization: `Bearer ${otherToken}` };
    const path = `/api/tasks/${created.body.id}`;

    expect((await http.get("/api/tasks").set(other).expect(200)).body).toEqual([]);
    await http.get(path).set(other).expect(404);
    await http.patch(path).set(other).send({ title: "Taken" }).expect(404);
    await http.delete(path).set(other).expect(404);
    await http.get(path).set(auth()).expect(200);
  });
});

describe("unknown API routes", () => {
  it("return JSON 404 instead of the SPA", async () => {
    const response = await http.get("/api/does-not-exist").expect(404);
    expect(response.headers["content-type"]).toMatch(/json/);
  });
});
