// Data source for the TypeORM CLI (migrations) and the seed script.
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { DataSource } from "typeorm";
import { ENV_FILE_PATH, validateEnvironment } from "../config/environment.ts";
import { databaseOptions } from "./database-options.ts";

if (existsSync(ENV_FILE_PATH)) loadEnvFile(ENV_FILE_PATH);

export default new DataSource(databaseOptions(validateEnvironment(process.env)));
