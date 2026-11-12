import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.ts";
import { AuthController } from "./auth.controller.ts";
import { AuthGuard } from "./auth.guard.ts";
import { AuthRepositoryPort, MysqlAuthRepository } from "./auth.repository.ts";
import { AuthService } from "./auth.service.ts";
import { JwtService } from "./jwt.service.ts";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    JwtService,
    AuthService,
    AuthGuard,
    {
      provide: AuthRepositoryPort,
      useClass: MysqlAuthRepository,
    },
  ],
  exports: [JwtService, AuthGuard, AuthRepositoryPort],
})
export class AuthModule {}
