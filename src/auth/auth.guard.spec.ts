import { type ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "./auth.guard.ts";
import type { AuthRepositoryPort } from "./auth.repository.ts";
import type { AuthenticatedRequest } from "./auth.types.ts";
import { JwtService } from "./jwt.service.ts";

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = { headers: authorization ? { authorization } : {} } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("AuthGuard", () => {
  it("rejects missing bearer token, invalid token, and deleted user", async () => {
    process.env.JWT_SECRET = "guard-test-secret";
    const jwtService = new JwtService();
    const findById = vi.fn().mockResolvedValueOnce({
      id: 7,
      email: "user7@example.com",
      display_name: "User 7",
    });

    const guard = new AuthGuard(jwtService, { findById } as unknown as AuthRepositoryPort);

    await expect(guard.canActivate(createContext().context)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    await expect(guard.canActivate(createContext("Basic abc").context)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    await expect(
      guard.canActivate(createContext("Bearer bad.token.here").context),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    const { access_token } = jwtService.signUserToken(7);
    const valid = createContext(`Bearer ${access_token}`);
    await expect(guard.canActivate(valid.context)).resolves.toBe(true);
    expect(valid.request.user).toEqual({
      id: 7,
      email: "user7@example.com",
      display_name: "User 7",
    });

    // Simulate deleted user in MySQL (A7)
    findById.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(createContext(`Bearer ${access_token}`).context),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});
