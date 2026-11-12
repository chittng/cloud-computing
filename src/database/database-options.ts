import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import type { DataSourceOptions } from "typeorm";
import { InitialSchema1793577600000 } from "./migrations/1793577600000-initial-schema.ts";
import { UnicodeCollation1793836800000 } from "./migrations/1793836800000-unicode-collation.ts";
import { RenamePassword1793836860000 } from "./migrations/1793836860000-rename-password.ts";

export function databaseOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const required = (name: string): string => {
    const value = env[name];
    if (!value?.trim()) throw new Error(`${name} must be set`);
    return value;
  };
  const port = Number(env.MYSQL_PORT ?? "3306");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be an integer between 1 and 65535");
  }

  return {
    type: "mysql",
    host: env.MYSQL_HOST ?? "127.0.0.1",
    port,
    username: required("MYSQL_USER"),
    password: required("MYSQL_PASSWORD"),
    database: required("MYSQL_DATABASE"),
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: ["DATE"],
    synchronize: false,
    migrationsRun: false,
    migrations: [
      InitialSchema1793577600000,
      UnicodeCollation1793836800000,
      RenamePassword1793836860000,
    ],
    migrationsTransactionMode: "none",
    logging: false,
  };
}

export function loadDatabaseOptions(): DataSourceOptions {
  if (existsSync(".env")) loadEnvFile(".env");
  return databaseOptions();
}
