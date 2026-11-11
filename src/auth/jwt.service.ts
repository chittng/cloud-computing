import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/api-error.ts";
import { loadAuthConfig } from "./auth-config.ts";

export interface VerifiedJwtPayload {
  userId: number;
  iat: number;
  exp: number;
}

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function parseBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(segment, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Issues and verifies RFC 7519 HS256 JWT tokens using Node crypto. */
@Injectable()
export class JwtService {
  signUserToken(
    userId: number,
    nowSeconds: number = Math.floor(Date.now() / 1000),
  ): { access_token: string; expires_in: number } {
    const { jwtSecret, jwtExpiresInSeconds } = loadAuthConfig();
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        sub: String(userId),
        iat: nowSeconds,
        exp: nowSeconds + jwtExpiresInSeconds,
      }),
    );

    const signingInput = `${header}.${payload}`;
    const signature = createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");

    return {
      access_token: `${signingInput}.${signature}`,
      expires_in: jwtExpiresInSeconds,
    };
  }

  verifyToken(
    token: string,
    nowSeconds: number = Math.floor(Date.now() / 1000),
  ): VerifiedJwtPayload {
    const { jwtSecret } = loadAuthConfig();
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw this.unauthorized();
    }

    const headerPart = parts[0] ?? "";
    const payloadPart = parts[1] ?? "";
    const signaturePart = parts[2] ?? "";
    if (!headerPart || !payloadPart || !signaturePart) {
      throw this.unauthorized();
    }

    const expectedSig = createHmac("sha256", jwtSecret)
      .update(`${headerPart}.${payloadPart}`)
      .digest("base64url");

    const actualBuf = Buffer.from(signaturePart, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
      throw this.unauthorized();
    }

    const header = parseBase64UrlJson(headerPart);
    if (!header || header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) {
      throw this.unauthorized();
    }

    const payload = parseBase64UrlJson(payloadPart);
    if (!payload) {
      throw this.unauthorized();
    }

    const sub = payload.sub;
    const iat = payload.iat;
    const exp = payload.exp;

    if (
      typeof sub !== "string" ||
      !POSITIVE_ID_PATTERN.test(sub) ||
      typeof iat !== "number" ||
      !Number.isFinite(iat) ||
      typeof exp !== "number" ||
      !Number.isFinite(exp)
    ) {
      throw this.unauthorized();
    }

    const userId = Number(sub);
    if (!Number.isSafeInteger(userId) || userId <= 0 || exp <= nowSeconds) {
      throw this.unauthorized();
    }

    return { userId, iat, exp };
  }

  private unauthorized(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      "UNAUTHORIZED",
      "Token không hợp lệ hoặc đã hết hạn",
    );
  }
}
