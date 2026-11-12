import { join } from "node:path";
import { ClassSerializerInterceptor, Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR, APP_PIPE, RouterModule } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module.ts";
import { ENV_FILE_PATH, type Environment, validateEnvironment } from "./config/environment.ts";
import { databaseOptions } from "./database/database-options.ts";
import { HealthModule } from "./health/health.module.ts";
import { TasksModule } from "./tasks/tasks.module.ts";

/** apps/web builds into apps/web/dist; this file sits directly under apps/api/{src,dist}. */
const WEB_DIST_PATH = join(import.meta.dirname, "..", "..", "web", "dist");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATH,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        databaseOptions({
          MYSQL_HOST: config.get("MYSQL_HOST", { infer: true }),
          MYSQL_PORT: config.get("MYSQL_PORT", { infer: true }),
          MYSQL_DATABASE: config.get("MYSQL_DATABASE", { infer: true }),
          MYSQL_USER: config.get("MYSQL_USER", { infer: true }),
          MYSQL_PASSWORD: config.get("MYSQL_PASSWORD", { infer: true }),
        }),
    }),
    ServeStaticModule.forRoot({
      rootPath: WEB_DIST_PATH,
      exclude: ["/api/{*path}", "/health"],
    }),
    AuthModule,
    TasksModule,
    HealthModule,
    RouterModule.register([
      { path: "api", module: AuthModule },
      { path: "api", module: TasksModule },
    ]),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
