import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./environment.ts";

const required = {
  MYSQL_DATABASE: "app",
  MYSQL_USER: "user",
  MYSQL_PASSWORD: "secret",
  JWT_SECRET: "jwt-secret",
};

describe("validateEnvironment", () => {
  it("applies defaults and converts numeric strings", () => {
    const env = validateEnvironment({ ...required, MYSQL_PORT: "3307" });

    expect(env).toMatchObject({
      PORT: 3000,
      MYSQL_HOST: "127.0.0.1",
      MYSQL_PORT: 3307,
      JWT_EXPIRES_IN: 3600,
    });
  });

  it("rejects missing required variables", () => {
    expect(() => validateEnvironment({ ...required, JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("rejects non-numeric ports", () => {
    expect(() => validateEnvironment({ ...required, MYSQL_PORT: "abc" })).toThrow(/MYSQL_PORT/);
  });
});
