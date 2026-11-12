import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ApiException } from "../common/api-error.ts";
import { AuthRepositoryPort } from "./auth.repository.ts";
import type { AuthenticatedRequest, AuthenticatedUser } from "./auth.types.ts";
import { JwtService } from "./jwt.service.ts";

const BEARER_HEADER_PATTERN = /^Bearer\s+(\S+)$/i;

/** Validates the Bearer JWT and ensures the referenced user still exists in MySQL. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(AuthRepositoryPort) private readonly authRepository: AuthRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawHeader = request.headers.authorization;
    if (typeof rawHeader !== "string") {
      throw this.unauthorized();
    }

    const match = BEARER_HEADER_PATTERN.exec(rawHeader.trim());
    const token = match?.[1];
    if (!token) {
      throw this.unauthorized();
    }

    const verified = this.jwtService.verifyToken(token);
    const user = await this.authRepository.findById(verified.userId);
    if (!user) {
      throw this.unauthorized();
    }

    request.user = user;
    return true;
  }

  private unauthorized(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      "UNAUTHORIZED",
      "Yêu cầu xác thực hoặc phiên đăng nhập đã hết hạn",
    );
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Chưa đăng nhập");
    }
    return request.user;
  },
);
