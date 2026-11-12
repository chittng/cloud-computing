import type { DataSourceOptions } from "typeorm";
import type { Environment } from "../config/environment.ts";
import { Task } from "../tasks/task.entity.ts";
import { User } from "../users/user.entity.ts";
import { InitialSchema1793577600000 } from "./migrations/1793577600000-initial-schema.ts";
import { UnicodeCollation1793836800000 } from "./migrations/1793836800000-unicode-collation.ts";
import { RenamePassword1793836860000 } from "./migrations/1793836860000-rename-password.ts";

type DatabaseEnvironment = Pick<
  Environment,
  "MYSQL_HOST" | "MYSQL_PORT" | "MYSQL_DATABASE" | "MYSQL_USER" | "MYSQL_PASSWORD"
>;

/** Shared by the Nest app and the TypeORM CLI data source. The schema is owned by migrations. */
export function databaseOptions(env: DatabaseEnvironment): DataSourceOptions {
  return {
    type: "mysql",
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    database: env.MYSQL_DATABASE,
    username: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    charset: "utf8mb4_unicode_ci",
    // The MySQL server runs in UTC; read and write DATETIME values as UTC.
    timezone: "Z",
    // Return BIGINT ids as numbers while they fit in a safe integer.
    bigNumberStrings: false,
    // Keep DATE columns as "YYYY-MM-DD" strings instead of local-midnight Date objects.
    dateStrings: ["DATE"],
    entities: [User, Task],
    migrations: [
      InitialSchema1793577600000,
      UnicodeCollation1793836800000,
      RenamePassword1793836860000,
    ],
    synchronize: false,
  };
}
