import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { type ApiErrorCode, ApiException } from "./api-error.ts";

interface BodyParserLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
}

function isHealthDownPayload(response: unknown): boolean {
  return (
    typeof response === "object" &&
    response !== null &&
    "database" in response &&
    "status" in response &&
    (response as Record<string, unknown>).status === "error"
  );
}

function mapHttpStatusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "VALIDATION_ERROR";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.METHOD_NOT_ALLOWED:
      return "METHOD_NOT_ALLOWED";
    case HttpStatus.CONFLICT:
      return "EMAIL_ALREADY_EXISTS";
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return "PAYLOAD_TOO_LARGE";
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return "UNSUPPORTED_MEDIA_TYPE";
    default:
      return "INTERNAL_ERROR";
  }
}

/** Normalizes non-health HTTP and unexpected errors into the API error JSON contract. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const parserError = exception as BodyParserLikeError | null;
    if (
      parserError &&
      typeof parserError === "object" &&
      (parserError.type === "entity.parse.failed" ||
        (exception instanceof SyntaxError && parserError.status === HttpStatus.BAD_REQUEST))
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: "INVALID_JSON",
          message: "Request body không phải JSON hợp lệ",
        },
      });
      return;
    }

    if (
      parserError &&
      typeof parserError === "object" &&
      (parserError.type === "entity.too.large" ||
        parserError.status === HttpStatus.PAYLOAD_TOO_LARGE)
    ) {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Kích thước request body vượt quá giới hạn 1 MB",
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (request.path === "/health" && isHealthDownPayload(rawResponse)) {
        response.status(status).json(rawResponse);
        return;
      }

      if (
        typeof rawResponse === "object" &&
        rawResponse !== null &&
        "error" in rawResponse &&
        typeof (rawResponse as Record<string, unknown>).error === "object"
      ) {
        response.status(status).json(rawResponse);
        return;
      }

      const code =
        exception instanceof BadRequestException &&
        !exception.message.startsWith("Failed to decode")
          ? "INVALID_JSON"
          : mapHttpStatusToErrorCode(status);
      const message =
        typeof rawResponse === "string"
          ? rawResponse
          : status === HttpStatus.NOT_FOUND
            ? "Đường dẫn không tồn tại"
            : exception.message || "Yêu cầu không hợp lệ";

      response.status(status).json({ error: { code, message } });
      return;
    }

    const summary = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(`Unhandled error on ${request.method} ${request.path}: ${summary}`);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Lỗi hệ thống nội bộ",
      },
    });
  }
}
