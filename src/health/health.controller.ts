import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Controller("health")
export class HealthController {
  constructor(@Inject(DataSource) private readonly database: DataSource) {}

  @Get()
  async check() {
    const timestamp = new Date().toISOString();
    try {
      await this.database.query("SELECT 1");
      return { status: "ok", database: "up", version: "v1.0", timestamp };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "down",
        version: "v1.0",
        timestamp,
      });
    }
  }
}
