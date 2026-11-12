import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import type { Environment } from "../config/environment.ts";
import { UsersModule } from "../users/users.module.ts";
import { AuthController } from "./auth.controller.ts";
import { AuthGuard } from "./auth.guard.ts";
import { AuthService } from "./auth.service.ts";

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get("JWT_SECRET", { infer: true }),
        signOptions: { expiresIn: config.get("JWT_EXPIRES_IN", { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
