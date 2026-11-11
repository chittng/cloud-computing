import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { HttpStatus, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { ApiException } from "./common/api-error.ts";
import { RootModule } from "./root.module.ts";

export const MAX_JSON_BODY_BYTES = 1024 * 1024;

function resolveFrontendDistDir(): string {
  const fromCompiled = resolve(import.meta.dirname, "..", "public");
  if (existsSync(join(fromCompiled, "index.html"))) {
    return fromCompiled;
  }
  return join(process.cwd(), "dist", "public");
}

export interface HttpAppOptions {
  publicDir?: string;
}

export function configureHttpApp(
  app: NestExpressApplication,
  options: HttpAppOptions = {},
): NestExpressApplication {
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

  const publicDir = options.publicDir ?? resolveFrontendDistDir();
  const indexHtmlPath = join(publicDir, "index.html");
  if (existsSync(indexHtmlPath)) {
    app.useStaticAssets(publicDir);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.method === "GET" &&
        req.path !== "/health" &&
        !req.path.startsWith("/api/") &&
        req.path !== "/api" &&
        !extname(req.path)
      ) {
        res.sendFile(indexHtmlPath);
        return;
      }
      next();
    });
  }

  app.enableShutdownHooks();
  return app;
}

export async function createHttpApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(RootModule);
  return configureHttpApp(app);
}
