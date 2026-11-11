import { beforeEach, describe, expect, it } from "vitest";
import { ApiException } from "../common/api-error.ts";
import { AuthRepositoryPort } from "./auth.repository.ts";
import { AuthService } from "./auth.service.ts";
import type { AuthenticatedUser, RegisterResponse, UserAuthRecord } from "./auth.types.ts";
import { JwtService } from "./jwt.service.ts";

class InMemoryAuthRepository extends AuthRepositoryPort {
  private nextId = 1;
  private users: UserAuthRecord[] = [];

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: number): Promise<AuthenticatedUser | null> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    return { id: user.id, email: user.email, display_name: user.displayName };
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string | null;
  }): Promise<RegisterResponse> {
    if (this.users.some((user) => user.email === input.email)) {
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
    return {
      id,
      email: input.email,
      display_name: input.displayName,
      created_at: createdAt,
    };
  }
}

describe("AuthService", () => {
  let repo: InMemoryAuthRepository;
  let authService: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = "auth-service-unit-secret";
    process.env.JWT_EXPIRES_IN = "3600";
    repo = new InMemoryAuthRepository();
    authService = new AuthService(repo, new JwtService());
  });

  it("normalizes email, hashes password, rejects duplicates, and logs in", async () => {
    const registered = await authService.register({
      email: "  An@Example.COM ",
      password: "Password123",
      display_name: "  An Nguyen  ",
      extra_ignored_field: true,
    });

    expect(registered).toEqual({
      id: 1,
      email: "an@example.com",
      display_name: "An Nguyen",
      created_at: expect.any(String),
    });

    const stored = await repo.findByEmail("an@example.com");
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored?.passwordHash).not.toBe("Password123");

    await expect(
      authService.register({ email: "AN@example.com", password: "Password123" }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_ALREADY_EXISTS" });

    const loginResult = await authService.login({
      email: " AN@Example.Com ",
      password: "Password123",
    });

    expect(loginResult).toMatchObject({
      access_token: expect.any(String),
      token_type: "Bearer",
      expires_in: 3600,
      user: {
        id: 1,
        email: "an@example.com",
        display_name: "An Nguyen",
      },
    });
  });

  it("validates UTF-8 byte password limits without trimming password", async () => {
    await expect(
      authService.register({ email: "a@b.com", password: "short" }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });

    // 25 Vietnamese 3-byte characters = 75 UTF-8 bytes (> 72 limit)
    await expect(
      authService.register({ email: "a@b.com", password: "ấ".repeat(25) }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });

    // Password with leading space is NOT trimmed
    await authService.register({ email: "space@b.com", password: " secret123" });
    await expect(
      authService.login({ email: "space@b.com", password: "secret123" }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    await expect(
      authService.login({ email: "space@b.com", password: " secret123" }),
    ).resolves.toMatchObject({ user: { email: "space@b.com" } });
  });

  it("returns identical error message for nonexistent email and wrong password", async () => {
    await authService.register({ email: "real@b.com", password: "Password123" });

    let unknownEmailErr: ApiException | undefined;
    let wrongPasswordErr: ApiException | undefined;

    try {
      await authService.login({ email: "missing@b.com", password: "Password123" });
    } catch (err) {
      unknownEmailErr = err as ApiException;
    }

    try {
      await authService.login({ email: "real@b.com", password: "WrongPassword" });
    } catch (err) {
      wrongPasswordErr = err as ApiException;
    }

    expect(unknownEmailErr?.getStatus()).toBe(401);
    expect(wrongPasswordErr?.getStatus()).toBe(401);
    expect(unknownEmailErr?.getResponse()).toEqual(wrongPasswordErr?.getResponse());
  });
});
