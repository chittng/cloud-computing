export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** True when an authenticated request was rejected, so the session must end. */
    readonly sessionExpired = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
}

/** Calls the NestJS API under /api and turns error responses into ApiError. */
export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (response.status === 401 && token) {
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", true);
  }
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, data));
  return data as T;
}

/** NestJS errors carry `message` as a string or, for validation errors, a list of strings. */
function errorMessage(status: number, data: unknown): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (status < 500) {
    if (Array.isArray(message) && typeof message[0] === "string") return message[0];
    if (typeof message === "string") return message;
  }
  return "Đã có lỗi xảy ra. Vui lòng thử lại sau.";
}
