import { describe, expect, it } from "vitest";
import { databaseOptions } from "./database-options.ts";

const env = {
  MYSQL_USER: "test_user",
  MYSQL_PASSWORD: "test_password",
  MYSQL_DATABASE: "cloud_computing_test",
};

describe("database configuration", () => {
  it.each(["MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"])(
    "rejects a missing %s before connecting",
    (name) => {
      expect(() => databaseOptions({ ...env, [name]: "" })).toThrow(`${name} must be set`);
    },
  );

  it.each(["", "abc", "0", "65536", "3306.5"])("rejects an invalid MySQL port (%s)", (port) => {
    expect(() => databaseOptions({ ...env, MYSQL_PORT: port })).toThrow("MYSQL_PORT");
  });
});
