import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from "class-validator";

/** The shared .env file lives at the repository root; pnpm runs api scripts from apps/api. */
export const ENV_FILE_PATH = "../../.env";

// Keep the explicit type annotations: class-transformer reads them to convert env strings.
export class Environment {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  MYSQL_HOST: string = "127.0.0.1";

  @IsInt()
  @Min(1)
  @Max(65535)
  MYSQL_PORT: number = 3306;

  @IsString()
  @IsNotEmpty()
  MYSQL_DATABASE: string;

  @IsString()
  @IsNotEmpty()
  MYSQL_USER: string;

  @IsString()
  @IsNotEmpty()
  MYSQL_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  /** Access token lifetime in seconds. */
  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN: number = 3600;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
    excludeExtraneousValues: false,
  });
  const errors = validateSync(environment, { whitelist: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }
  return environment;
}
