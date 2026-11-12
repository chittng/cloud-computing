import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { AuthGuard } from "./auth.guard.ts";
import { Public } from "./public.decorator.ts";

const jwtService = new JwtService({ secret: "unit-test-secret" });
const guard = new AuthGuard(jwtService, new Reflector());

class ProbeController {
  @Public()
  open(): void {}

  closed(): void {}
}

function contextFor(handler: keyof ProbeController, authorization?: string) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => ProbeController.prototype[handler],
    getClass: () => ProbeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("AuthGuard", () => {
  it("lets @Public() routes through without a token", async () => {
    await expect(guard.canActivate(contextFor("open").context)).resolves.toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["a non-bearer scheme", "Basic abc"],
    ["an invalid token", "Bearer not-a-jwt"],
  ])("rejects %s", async (_case, authorization) => {
    await expect(
      guard.canActivate(contextFor("closed", authorization).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches the token payload to the request", async () => {
    const token = await jwtService.signAsync({ sub: 3, email: "a@example.test" });
    const { context, request } = contextFor("closed", `Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 3, email: "a@example.test" });
  });
});
