import { describe, expect, it } from "vitest";
import { authConfig } from "./auth-config.ts";
import { JwtService } from "./jwt.service.ts";
import { ApiException } from "../common/api-error.ts";

describe("auth configuration and JWT service", () => {
  it("rejects missing JWT_SECRET or invalid JWT_EXPIRES_IN", () => {
    expect(() => authConfig({ JWT_SECRET: "" })).toThrow("JWT_SECRET");
    expect(() => authConfig({ JWT_SECRET: "secret", JWT_EXPIRES_IN: "0" })).toThrow(
      "JWT_EXPIRES_IN",
    );
    expect(() => authConfig({ JWT_SECRET: "secret", JWT_EXPIRES_IN: "abc" })).toThrow(
      "JWT_EXPIRES_IN",
    );
    expect(authConfig({ JWT_SECRET: "super-secret" })).toEqual({
      jwtSecret: "super-secret",
      jwtExpiresInSeconds: 3600,
    });
  });

  it("signs and verifies valid HS256 JWT tokens with string sub", () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousExpires = process.env.JWT_EXPIRES_IN;
    process.env.JWT_SECRET = "unit-test-secret-key";
    process.env.JWT_EXPIRES_IN = "1800";

    try {
      const jwtService = new JwtService();
      const signed = jwtService.signUserToken(42, 1000);
      expect(signed.expires_in).toBe(1800);

      const parts = signed.access_token.split(".");
      expect(parts).toHaveLength(3);
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
      expect(payload).toEqual({ sub: "42", iat: 1000, exp: 2800 });

      expect(jwtService.verifyToken(signed.access_token, 2799)).toEqual({
        userId: 42,
        iat: 1000,
        exp: 2800,
      });

      expect(() => jwtService.verifyToken(signed.access_token, 2800)).toThrow(ApiException);

      const tampered =
        signed.access_token.slice(0, -1) + (signed.access_token.endsWith("A") ? "B" : "A");
      expect(() => jwtService.verifyToken(tampered, 1000)).toThrow(ApiException);
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
      if (previousExpires === undefined) delete process.env.JWT_EXPIRES_IN;
      else process.env.JWT_EXPIRES_IN = previousExpires;
    }
  });
});
