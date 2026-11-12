import {
  Controller,
  Get,
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  UseGuards,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { configureHttpApp } from "../src/app.factory.ts";
import { AuthController } from "../src/auth/auth.controller.ts";
import { AuthGuard, CurrentUser } from "../src/auth/auth.guard.ts";
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
import {
  ApiRequestMiddleware,
  getRegisteredApiRouteRules,
  type RouteMethodRule,
} from "../src/common/api-request.middleware.ts";

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

class AuthTestMiddleware extends ApiRequestMiddleware {
  protected override getRouteRules(): readonly RouteMethodRule[] {
    return [...getRegisteredApiRouteRules(), { pattern: /^\/api\/v1\/probe$/, methods: ["GET"] }];
  }
}

@Controller("api/v1/probe")
class AuthProbeController {
  @Get()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

describe("Auth API HTTP contract (CLOUD-8)", () => {
  let app: INestApplication;
  let repo: InMemoryAuthRepo;

  beforeAll(async () => {
    process.env.JWT_SECRET = "e2e-test-jwt-secret";
    process.env.JWT_EXPIRES_IN = "3600";
    repo = new InMemoryAuthRepo();

    @Module({
      controllers: [AuthController, AuthProbeController],
      providers: [
        JwtService,
        AuthService,
        AuthGuard,
        { provide: AuthRepositoryPort, useValue: repo },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    })
    class AuthHttpTestModule implements NestModule {
      configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthTestMiddleware).forRoutes("/");
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [AuthHttpTestModule] }).compile();
    const expressApp = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(expressApp);
    app = await expressApp.init();
  });

  beforeEach(() => {
    repo.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("supports register -> login -> authenticated probe -> deleted user rejection", async () => {
    const regRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: "  Trang@Example.com ", password: "Password123!", display_name: "Trang" })
      .expect(201);

    expect(regRes.body).toEqual({
      id: 1,
      email: "trang@example.com",
      display_name: "Trang",
      created_at: expect.any(String),
    });
    expect(regRes.body.password).toBeUndefined();
    expect(regRes.body.password_hash).toBeUndefined();

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "TRANG@example.com", password: "Password123!" })
      .expect(200);

    expect(loginRes.body).toMatchObject({
      access_token: expect.any(String),
      token_type: "Bearer",
      expires_in: 3600,
      user: { id: 1, email: "trang@example.com", display_name: "Trang" },
    });

    await request(app.getHttpServer()).get("/api/v1/probe").expect(401);

    await request(app.getHttpServer())
      .get("/api/v1/probe")
      .set("Authorization", `Bearer ${loginRes.body.access_token}`)
      .expect(200)
      .expect({ id: 1, email: "trang@example.com", display_name: "Trang" });

    // Remove user from database while token is unexpired
    repo.users = [];
    const deletedRes = await request(app.getHttpServer())
      .get("/api/v1/probe")
      .set("Authorization", `Bearer ${loginRes.body.access_token}`)
      .expect(401);
    expect(deletedRes.body.error.code).toBe("UNAUTHORIZED");
  });

  it("enforces Content-Type (415), INVALID_JSON (400), PAYLOAD_TOO_LARGE (413), 404, and 405", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Content-Type", "text/plain")
      .send('{"email":"a@b.com","password":"Password123"}')
      .expect(415)
      .expect((res) => {
        expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{broken-json")
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("INVALID_JSON");
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(["not-an-object"])
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("INVALID_JSON");
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send({ email: "big@example.com", password: "Password123", extra: "a".repeat(1024 * 1025) })
      .expect(413)
      .expect((res) => {
        expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
      });

    await request(app.getHttpServer())
      .get("/api/v1/auth/login")
      .expect(405)
      .expect((res) => {
        expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
      });

    await request(app.getHttpServer())
      .get("/api/v1/unknown-endpoint")
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe("NOT_FOUND");
      });
  });
});
