import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const TEST_ENV_FILE = "../../.env.test";

export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    env: existsSync(TEST_ENV_FILE) ? parseEnv(readFileSync(TEST_ENV_FILE, "utf8")) : {},
    fileParallelism: false,
  },
});
