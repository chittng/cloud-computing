import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { compare, hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../users/user.entity.ts";
import { UsersService } from "../users/users.service.ts";
import { AuthService } from "./auth.service.ts";

describe("AuthService", () => {
  const usersService = { create: vi.fn(), findByEmailWithPassword: vi.fn() };
  const jwtService = new JwtService({ secret: "unit-test-secret" });
  let authService: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: () => 1800 } },
      ],
    }).compile();
    authService = moduleRef.get(AuthService);
  });

  it("stores a bcrypt hash instead of the plain password", async () => {
    usersService.create.mockImplementation(async (data: Partial<User>) => ({ id: 1, ...data }));

    await authService.register({ email: "a@example.test", password: "password123" });

    const saved = usersService.create.mock.calls[0]?.[0] as User;
    expect(saved.password).not.toBe("password123");
    expect(await compare("password123", saved.password)).toBe(true);
    expect(saved.displayName).toBeNull();
  });

  it("issues a token for the user on valid credentials", async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      email: "a@example.test",
      displayName: "A",
      password: await hash("password123", 4),
    });

    const result = await authService.login({ email: "a@example.test", password: "password123" });

    expect(result.expiresIn).toBe(1800);
    expect(result.user).toEqual({ id: 7, email: "a@example.test", displayName: "A" });
    expect(await jwtService.verifyAsync(result.accessToken)).toMatchObject({
      sub: 7,
      email: "a@example.test",
    });
  });

  it.each([
    ["an unknown email", null],
    ["a wrong password", { id: 7, email: "a@example.test", password: "$2b$04$invalidhash" }],
  ])("rejects %s with 401", async (_case, user) => {
    usersService.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      authService.login({ email: "a@example.test", password: "password123" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
