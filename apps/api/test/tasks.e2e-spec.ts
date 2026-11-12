import {
  HttpStatus,
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { configureHttpApp } from "../src/app.factory.ts";
import { AuthController } from "../src/auth/auth.controller.ts";
import { AuthGuard } from "../src/auth/auth.guard.ts";
import { AuthRepositoryPort } from "../src/auth/auth.repository.ts";
import { AuthService } from "../src/auth/auth.service.ts";
import type {
  AuthenticatedUser,
  RegisterResponse,
  UserAuthRecord,
} from "../src/auth/auth.types.ts";
import { JwtService } from "../src/auth/jwt.service.ts";
import { ApiException } from "../src/common/api-error.ts";
import { ApiExceptionFilter } from "../src/common/api-exception.filter.ts";
import { ApiRequestMiddleware } from "../src/common/api-request.middleware.ts";
import { TasksController } from "../src/tasks/tasks.controller.ts";
import { TasksRepositoryPort } from "../src/tasks/tasks.repository.ts";
import { TasksService } from "../src/tasks/tasks.service.ts";
import type {
  CreateTaskData,
  TaskDto,
  TaskStatus,
  UpdateTaskFields,
} from "../src/tasks/tasks.types.ts";

class InMemoryAuthRepo extends AuthRepositoryPort {
  private nextId = 1;
  users: UserAuthRecord[] = [];

  reset(): void {
    this.nextId = 1;
    this.users = [];
  }

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: number): Promise<AuthenticatedUser | null> {
    const found = this.users.find((u) => u.id === id);
    return found ? { id: found.id, email: found.email, display_name: found.displayName } : null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string | null;
  }): Promise<RegisterResponse> {
    if (this.users.some((u) => u.email === input.email)) {
      throw new ApiException(409, "EMAIL_ALREADY_EXISTS", "Email đã được đăng ký");
    }
    const id = this.nextId++;
    const createdAt = "2026-11-11T00:00:00.000Z";
    this.users.push({
      id,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      createdAt,
    });
    return { id, email: input.email, display_name: input.displayName, created_at: createdAt };
  }
}

class InMemoryTasksRepo extends TasksRepositoryPort {
  private nextId = 1;
  private tasks: Array<TaskDto & { userId: number }> = [];
  private tick = 1;

  constructor(private readonly authRepo: InMemoryAuthRepo) {
    super();
  }

  reset(): void {
    this.nextId = 1;
    this.tasks = [];
    this.tick = 1;
  }

  async createForUser(data: CreateTaskData): Promise<TaskDto> {
    const userExists = this.authRepo.users.some((u) => u.id === data.userId);
    if (!userExists) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
        "Tài khoản không còn tồn tại hoặc phiên đăng nhập không hợp lệ",
      );
    }
    const ts = `2026-11-11T00:00:0${Math.min(9, this.tick++)}.000Z`;
    const record = {
      id: this.nextId++,
      userId: data.userId,
      title: data.title,
      description: data.description,
      due_date: data.dueDate,
      status: data.status,
      created_at: ts,
      updated_at: ts,
    };
    this.tasks.push(record);
    return this.toDto(record);
  }

  async listForUser(userId: number, status?: TaskStatus): Promise<TaskDto[]> {
    return this.tasks
      .filter((t) => t.userId === userId && (!status || t.status === status))
      .sort((a, b) => {
        if (a.due_date === null && b.due_date !== null) return 1;
        if (a.due_date !== null && b.due_date === null) return -1;
        if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return a.id - b.id;
      })
      .map((t) => this.toDto(t));
  }

  async findByIdForUser(id: number, userId: number): Promise<TaskDto | null> {
    const found = this.tasks.find((t) => t.id === id && t.userId === userId);
    return found ? this.toDto(found) : null;
  }

  async updateForUser(
    id: number,
    userId: number,
    fields: UpdateTaskFields,
  ): Promise<TaskDto | null> {
    const found = this.tasks.find((t) => t.id === id && t.userId === userId);
    if (!found) return null;
    if (fields.title !== undefined) found.title = fields.title;
    if (fields.description !== undefined) found.description = fields.description;
    if (fields.dueDate !== undefined) found.due_date = fields.dueDate;
    if (fields.status !== undefined) found.status = fields.status;
    return this.toDto(found);
  }

  async deleteForUser(id: number, userId: number): Promise<boolean> {
    const idx = this.tasks.findIndex((t) => t.id === id && t.userId === userId);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    return true;
  }

  private toDto(t: TaskDto & { userId: number }): TaskDto {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }
}

describe("Tasks API HTTP contract & isolation (CLOUD-9)", () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepo;
  let tasksRepo: InMemoryTasksRepo;

  beforeAll(async () => {
    process.env.JWT_SECRET = "tasks-e2e-jwt-secret";
    process.env.JWT_EXPIRES_IN = "3600";

    authRepo = new InMemoryAuthRepo();
    tasksRepo = new InMemoryTasksRepo(authRepo);

    @Module({
      controllers: [AuthController, TasksController],
      providers: [
        JwtService,
        AuthService,
        AuthGuard,
        TasksService,
        { provide: AuthRepositoryPort, useValue: authRepo },
        { provide: TasksRepositoryPort, useValue: tasksRepo },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    })
    class TasksHttpTestModule implements NestModule {
      configure(consumer: MiddlewareConsumer): void {
        consumer.apply(ApiRequestMiddleware).forRoutes("/");
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [TasksHttpTestModule] }).compile();
    const expressApp = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(expressApp);
    app = await expressApp.init();
  });

  beforeEach(() => {
    authRepo.reset();
    tasksRepo.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function registerAndLogin(email: string, displayName: string): Promise<string> {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password: "Password123!", display_name: displayName })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" })
      .expect(200);
    return login.body.access_token as string;
  }

  it("supports full CRUD, sorting (NULL due_date last), filtering, PATCH, DELETE 204, and rejects PUT 405", async () => {
    const token = await registerAndLogin("usera@example.com", "User A");

    const tNoDue = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "No deadline" })
      .expect(201);
    expect(tNoDue.headers.location).toBe(`/api/v1/tasks/${tNoDue.body.id}`);

    const tLater = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Later", due_date: "2026-12-20", description: "Desc" })
      .expect(201);

    const tEarlier = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Earlier", due_date: "2026-11-15", status: "completed" })
      .expect(201);

    const listAll = await request(app.getHttpServer())
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listAll.body.count).toBe(3);
    expect(listAll.body.items.map((t: TaskDto) => t.id)).toEqual([
      tEarlier.body.id,
      tLater.body.id,
      tNoDue.body.id,
    ]);

    const listPending = await request(app.getHttpServer())
      .get("/api/v1/tasks?status=pending")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listPending.body.items.map((t: TaskDto) => t.title)).toEqual(["Later", "No deadline"]);

    const listCompleted = await request(app.getHttpServer())
      .get("/api/v1/tasks?status=completed")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listCompleted.body.items.map((t: TaskDto) => t.title)).toEqual(["Earlier"]);

    await request(app.getHttpServer())
      .get(`/api/v1/tasks/${tLater.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${tLater.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated title", description: null, due_date: null, status: "completed" })
      .expect(200);
    expect(patched.body).toMatchObject({
      id: tLater.body.id,
      title: "Updated title",
      description: null,
      due_date: null,
      status: "completed",
    });

    await request(app.getHttpServer())
      .put(`/api/v1/tasks/${tLater.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should fail 405" })
      .expect(405)
      .expect((res) => {
        expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/${tLater.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/${tLater.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe("TASK_NOT_FOUND");
      });
  });

  it("satisfies authorization matrix A1-A7 from docs/api-spec.md", async () => {
    const tokenA = await registerAndLogin("alice@example.com", "Alice");
    const tokenB = await registerAndLogin("bob@example.com", "Bob");

    // A1: Unauthenticated request to /tasks -> 401
    await request(app.getHttpServer()).get("/api/v1/tasks").expect(401);

    // User A creates task; A5: body user_id: 99 is ignored
    const createdByA = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Bob task owned by token user", user_id: 1 })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(listA.body).toEqual({ items: [], count: 0 });

    const createdRealA = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "Alice private task" })
      .expect(201);

    // A2: User B reads A's task -> 404 TASK_NOT_FOUND
    await request(app.getHttpServer())
      .get(`/api/v1/tasks/${createdRealA.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404)
      .expect((res) => expect(res.body.error.code).toBe("TASK_NOT_FOUND"));

    // A3: User B PATCH & DELETE A's task -> 404 and A's task unchanged
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${createdRealA.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Hacked" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/${createdRealA.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/tasks/${createdRealA.body.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200)
      .expect((res) => expect(res.body.title).toBe("Alice private task"));

    // A4: User B listing excludes User A's task
    const listB = await request(app.getHttpServer())
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(listB.body.items.map((t: TaskDto) => t.id)).toEqual([createdByA.body.id]);

    // A6: Tampered token -> 401
    const badToken = tokenA.slice(0, -1) + (tokenA.endsWith("A") ? "B" : "A");
    await request(app.getHttpServer())
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${badToken}`)
      .expect(401);

    // A7: Valid token when user deleted from DB -> 401 (no 500)
    authRepo.users = authRepo.users.filter((u) => u.email !== "alice@example.com");
    await request(app.getHttpServer())
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "After delete" })
      .expect(401);
  });
});
