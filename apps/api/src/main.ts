import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import type { Environment } from "./config/environment.ts";

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(app.get(ConfigService<Environment, true>).get("PORT", { infer: true }));
