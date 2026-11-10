import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.ts";
import { HealthController } from "./health/health.controller.ts";

@Module({ imports: [DatabaseModule], controllers: [HealthController] })
export class RootModule {}
