import { HttpStatus, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ApiException } from "./api-error.ts";

export interface RouteMethodRule {
  pattern: RegExp;
  methods: readonly string[];
}

const MAX_API_BODY_BYTES = 1024 * 1024;
const METHODS_WITH_JSON_BODY = new Set(["POST", "PATCH", "PUT"]);

export function getRegisteredApiRouteRules(): readonly RouteMethodRule[] {
  return [
    { pattern: /^\/api\/v1\/auth\/register$/, methods: ["POST"] },
    { pattern: /^\/api\/v1\/auth\/login$/, methods: ["POST"] },
    { pattern: /^\/api\/v1\/tasks$/, methods: ["GET", "POST"] },
    { pattern: /^\/api\/v1\/tasks\/[^/]+$/, methods: ["GET", "PATCH", "DELETE"] },
  ];
}

function isJsonMediaType(contentTypeHeader: string | string[] | undefined): boolean {
  if (typeof contentTypeHeader !== "string") return false;
  const mimeType = contentTypeHeader.split(";")[0]?.trim().toLowerCase() ?? "";
  return mimeType === "application/json" || mimeType.endsWith("+json");
}

function normalizePath(urlPath: string): string {
  if (urlPath.length > 1 && urlPath.endsWith("/")) {
    return urlPath.slice(0, -1);
  }
  return urlPath;
}

/**
 * Enforces API route existence (404), HTTP method allow-lists (405),
 * JSON Content-Type (415), and 1 MB payload size ceiling (413) for /api/* requests.
 */
@Injectable()
export class ApiRequestMiddleware implements NestMiddleware {
  protected getRouteRules(): readonly RouteMethodRule[] {
    return getRegisteredApiRouteRules();
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const path = normalizePath(req.path);

    if (path === "/health") {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        throw new ApiException(
          HttpStatus.METHOD_NOT_ALLOWED,
          "METHOD_NOT_ALLOWED",
          "Phương thức HTTP không được hỗ trợ",
        );
      }
      next();
      return;
    }

    if (!path.startsWith("/api/") && path !== "/api") {
      next();
      return;
    }

    const matchedRule = this.getRouteRules().find((rule) => rule.pattern.test(path));
    if (!matchedRule) {
      throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Đường dẫn không tồn tại");
    }

    if (!matchedRule.methods.includes(req.method)) {
      res.setHeader("Allow", matchedRule.methods.join(", "));
      throw new ApiException(
        HttpStatus.METHOD_NOT_ALLOWED,
        "METHOD_NOT_ALLOWED",
        "Phương thức HTTP không được hỗ trợ",
      );
    }

    const contentLengthHeader = req.headers["content-length"];
    if (typeof contentLengthHeader === "string") {
      const parsedLength = Number(contentLengthHeader);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_API_BODY_BYTES) {
        throw new ApiException(
          HttpStatus.PAYLOAD_TOO_LARGE,
          "PAYLOAD_TOO_LARGE",
          "Kích thước request body vượt quá giới hạn 1 MB",
        );
      }
    }

    if (METHODS_WITH_JSON_BODY.has(req.method) && !isJsonMediaType(req.headers["content-type"])) {
      throw new ApiException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        "UNSUPPORTED_MEDIA_TYPE",
        "Content-Type phải là application/json",
      );
    }

    next();
  }
}
