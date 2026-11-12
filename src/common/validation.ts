import { HttpStatus } from "@nestjs/common";
import { ApiException, type FieldErrorDetail, validationError } from "./api-error.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSITIVE_INT_PATTERN = /^[1-9]\d*$/;

export function parsePlainJsonObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "INVALID_JSON",
      "Request body phải là JSON object hợp lệ",
    );
  }
  return body as Record<string, unknown>;
}

export function toSafePositiveId(raw: unknown): number {
  if (typeof raw === "number") {
    if (Number.isSafeInteger(raw) && raw > 0) return raw;
    throw new Error(`Unsafe or invalid positive integer ID: ${raw}`);
  }
  if (typeof raw === "bigint") {
    const num = Number(raw);
    if (raw > 0n && num <= Number.MAX_SAFE_INTEGER && Number.isSafeInteger(num)) return num;
    throw new Error(`BIGINT ID exceeds safe integer range: ${raw}`);
  }
  if (typeof raw === "string" && POSITIVE_INT_PATTERN.test(raw)) {
    const num = Number(raw);
    if (Number.isSafeInteger(num) && num > 0) return num;
  }
  throw new Error(`Invalid BIGINT ID value: ${String(raw)}`);
}

export function parsePositiveIntParam(raw: string, field = "id"): number {
  if (!POSITIVE_INT_PATTERN.test(raw)) {
    throw validationError([{ field, message: `${field} phải là số nguyên dương` }]);
  }
  const num = Number(raw);
  if (!Number.isSafeInteger(num) || num <= 0) {
    throw validationError([{ field, message: `${field} phải là số nguyên dương hợp lệ` }]);
  }
  return num;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function isValidDateOnlyString(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function formatUtcIsoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp value: ${String(value)}`);
  }
  return date.toISOString();
}

export function extractMysqlErrorDetails(error: unknown): { code?: string; errno?: number } {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  const driver =
    typeof record.driverError === "object" && record.driverError !== null
      ? (record.driverError as Record<string, unknown>)
      : record;
  return {
    code: typeof driver.code === "string" ? driver.code : undefined,
    errno: typeof driver.errno === "number" ? driver.errno : undefined,
  };
}

export function pushDetail(details: FieldErrorDetail[], field: string, message: string): void {
  details.push({ field, message });
}
