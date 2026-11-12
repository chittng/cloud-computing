import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Controller,
  Get,
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureHttpApp } from "../src/app.factory.ts";
import { ApiExceptionFilter } from "../src/common/api-exception.filter.ts";
import { ApiRequestMiddleware } from "../src/common/api-request.middleware.ts";

@Controller("health")
class ProbeHealthController {
  @Get()
  status(): { status: string } {
    return { status: "ok" };
  }
}

@Module({
  controllers: [ProbeHealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
class SpaProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiRequestMiddleware).forRoutes("/");
  }
}

describe("SPA static fallback hosting", () => {
  let app: INestApplication;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "cloud-spa-"));
    writeFileSync(join(tempDir, "index.html"), "<!doctype html><html><body>Task UI</body></html>");

    const moduleRef = await Test.createTestingModule({
      imports: [SpaProbeModule],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(nestApp, { publicDir: tempDir });
    await nestApp.init();
    app = nestApp;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("serves SPA index.html for client routes while keeping /health and /api JSON responses", async () => {
    await request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect("Content-Type", /text\/html/)
      .expect((res) => {
        expect(res.text).toContain("Task UI");
      });

    await request(app.getHttpServer())
      .get("/login")
      .expect(200)
      .expect("Content-Type", /text\/html/);

    await request(app.getHttpServer()).get("/health").expect(200).expect({ status: "ok" });

    await request(app.getHttpServer())
      .get("/api/v1/unknown-endpoint")
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe("NOT_FOUND");
      });
  });
});
