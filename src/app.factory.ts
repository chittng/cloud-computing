import { HttpStatus, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { ApiException } from "./common/api-error.ts";
import { RootModule } from "./root.module.ts";

export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export function configureHttpApp(app: NestExpressApplication): NestExpressApplication {
  app.useBodyParser("json", { limit: MAX_JSON_BODY_BYTES, strict: false });
  app.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError) {
      next(
        new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_JSON",
          "Request body không phải JSON hợp lệ",
        ),
      );
      return;
    }
    next(err);
  });
  app.enableShutdownHooks();
  return app;
}

export async function createHttpApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(RootModule);
  return configureHttpApp(app);
}
