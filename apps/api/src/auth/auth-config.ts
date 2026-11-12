import { loadRootEnvFile } from "../common/env-file.ts";

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresInSeconds: number;
}

const DEFAULT_JWT_EXPIRES_IN_SECONDS = 3600;

export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET must be set");
  }

  const rawExpires = env.JWT_EXPIRES_IN ?? String(DEFAULT_JWT_EXPIRES_IN_SECONDS);
  const jwtExpiresInSeconds = Number(rawExpires);
  if (!Number.isInteger(jwtExpiresInSeconds) || jwtExpiresInSeconds < 1) {
    throw new Error("JWT_EXPIRES_IN must be a positive integer");
  }

  return { jwtSecret, jwtExpiresInSeconds };
}

export function loadAuthConfig(): AuthConfig {
  loadRootEnvFile();
  return authConfig();
}
