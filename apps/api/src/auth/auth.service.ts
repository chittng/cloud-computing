import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import type { Environment } from "../config/environment.ts";
import type { User } from "../users/user.entity.ts";
import { UsersService } from "../users/users.service.ts";
import type { JwtPayload } from "./current-user.decorator.ts";
import type { LoginDto } from "./dto/login.dto.ts";
import type { RegisterDto } from "./dto/register.dto.ts";

const BCRYPT_ROUNDS = 12;

export interface LoginResponse {
  accessToken: string;
  /** Token lifetime in seconds. */
  expiresIn: number;
  user: Pick<User, "id" | "email" | "displayName">;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async register({ email, password, displayName }: RegisterDto): Promise<User> {
    return this.usersService.create({
      email,
      password: await hash(password, BCRYPT_ROUNDS),
      displayName: displayName ?? null,
    });
  }

  async login({ email, password }: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      expiresIn: this.config.get("JWT_EXPIRES_IN", { infer: true }),
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }
}
