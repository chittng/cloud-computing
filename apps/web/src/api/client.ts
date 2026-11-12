export interface UserProfile {
  id: number;
  email: string;
  display_name: string | null;
}

export interface RegisterApiResponse {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface LoginApiResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: UserProfile;
}

export type TaskStatus = "pending" | "completed";
export type TaskFilter = "all" | TaskStatus;

export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskListApiResponse {
  items: TaskItem[];
  count: number;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function extractErrorMessage(
  payload: ApiErrorPayload | null,
  fallback: string,
): {
  code: string;
  message: string;
} {
  const code = payload?.error?.code ?? "UNKNOWN_ERROR";
  const firstDetail = payload?.error?.details?.[0]?.message;
  const message = firstDetail || payload?.error?.message || fallback;
  return { code, message };
}

async function requestJson<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 204) {
    return undefined as T;
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const { code, message } = extractErrorMessage(parsed as ApiErrorPayload | null, fallbackError);
    throw new ApiClientError(response.status, code, message);
  }

  return parsed as T;
}

export function registerAccount(input: {
  email: string;
  password: string;
  display_name: string | null;
}): Promise<RegisterApiResponse> {
  return requestJson<RegisterApiResponse>(
    "/api/v1/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "Đăng ký tài khoản thất bại!",
  );
}

export function loginAccount(input: {
  email: string;
  password: string;
}): Promise<LoginApiResponse> {
  return requestJson<LoginApiResponse>(
    "/api/v1/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "Đăng nhập không thành công!",
  );
}

export function fetchTasks(accessToken: string, status?: TaskStatus): Promise<TaskListApiResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson<TaskListApiResponse>(
    `/api/v1/tasks${query}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Không thể tải danh sách công việc!",
  );
}

export function createTask(
  accessToken: string,
  input: {
    title: string;
    description: string | null;
    due_date: string | null;
  },
): Promise<TaskItem> {
  return requestJson<TaskItem>(
    "/api/v1/tasks",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    },
    "Không thể thêm công việc!",
  );
}

export function updateTask(
  accessToken: string,
  taskId: number,
  patch: Partial<{
    title: string;
    description: string | null;
    due_date: string | null;
    status: TaskStatus;
  }>,
): Promise<TaskItem> {
  return requestJson<TaskItem>(
    `/api/v1/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(patch),
    },
    "Không thể cập nhật công việc!",
  );
}

export function deleteTask(accessToken: string, taskId: number): Promise<void> {
  return requestJson<void>(
    `/api/v1/tasks/${taskId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Không thể xóa công việc!",
  );
}
