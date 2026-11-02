import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthController } from "../src/health/health.controller.ts";

describe("GET /health", () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it.each([true, false])("reports database availability: %s", async (available) => {
    const query = available
      ? vi.fn().mockResolvedValue([{ 1: 1 }])
      : vi.fn().mockRejectedValue(new Error("secret database connection details"));
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: { query } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const response = await request(app.getHttpServer())
      .get("/health")
      .expect(available ? 200 : 503);
    expect(query).toHaveBeenCalledWith("SELECT 1");
    expect(response.body).toEqual({
      status: available ? "ok" : "error",
      database: available ? "up" : "down",
      version: "v1.0",
      timestamp: expect.any(String),
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    expect(response.text).not.toContain("secret");
  });
});
