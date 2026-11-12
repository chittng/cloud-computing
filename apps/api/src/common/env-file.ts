import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

// The shared .env lives at the repository root, next to compose.yaml.
// This file sits at the same depth in src/ and dist/, so the path holds for both.
const ROOT_ENV_FILE = resolve(import.meta.dirname, "..", "..", "..", "..", ".env");

export function loadRootEnvFile(): void {
  if (existsSync(ROOT_ENV_FILE)) loadEnvFile(ROOT_ENV_FILE);
}
