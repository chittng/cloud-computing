import { HttpException, HttpStatus } from "@nestjs/common";

export type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "TASK_NOT_FOUND"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "EMAIL_ALREADY_EXISTS"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR";

export interface FieldErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: FieldErrorDetail[];
  };
}

/** Structured HTTP exception matching docs/api-spec.md section 5. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ApiErrorCode,
    readonly errorMessage: string,
    readonly details?: FieldErrorDetail[],
  ) {
    const body: ApiErrorBody = {
      error: {
        code,
        message: errorMessage,
        ...(details && details.length > 0 ? { details } : {}),
      },
    };
    super(body, status);
  }
}

export function validationError(
  details: FieldErrorDetail[],
  message = "Dữ liệu không hợp lệ",
): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, details);
}
