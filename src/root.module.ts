import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.ts";
import { ApiExceptionFilter } from "./common/api-exception.filter.ts";
import { ApiRequestMiddleware } from "./common/api-request.middleware.ts";
import { DatabaseModule } from "./database/database.module.ts";
import { HealthController } from "./health/health.controller.ts";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class RootModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiRequestMiddleware).forRoutes("/");
  }
}
