import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface JwtPayload {
  sub: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/** The token payload that AuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
