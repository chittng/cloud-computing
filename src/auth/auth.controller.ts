import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.ts";
import type { LoginResponse, RegisterResponse } from "./auth.types.ts";

@Controller("api/v1/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: unknown): Promise<RegisterResponse> {
    return this.authService.register(body);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown): Promise<LoginResponse> {
    return this.authService.login(body);
  }
}
