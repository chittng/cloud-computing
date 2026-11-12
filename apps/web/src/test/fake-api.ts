import { vi } from "vitest";
import type { User } from "@/features/auth/api";
import type { Session } from "@/features/auth/session";
import type { Task } from "@/features/tasks/api";

export const TOKEN = "valid-token";
export const PASSWORD = "password123";
export const alice: User = { id: 1, email: "alice@example.test", displayName: "Alice" };

export function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    description: null,
    dueDate: null,
    status: "pending",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Stores a signed-in session the way the app does after "remember me" login. */
export function signInAs(user: User, token = TOKEN): void {
  const session: Session = { accessToken: token, expiresAt: Date.now() + 3_600_000, user };
  localStorage.setItem("task-manager.session", JSON.stringify(session));
}

type FetchInit = Omit<RequestInit, "body"> & { body?: string };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Replaces fetch with an in-memory version of the NestJS API. */
export function installFakeApi(initialTasks: Task[] = []) {
  const tasks = [...initialTasks];
  let nextId = Math.max(0, ...tasks.map((task) => task.id)) + 1;

  // The app always calls fetch with a string URL and a JSON string body.
  const fetchMock = vi.fn(async (input: string, init: FetchInit = {}) => {
    const url = new URL(input, "http://localhost");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    const authorized = new Headers(init.headers).get("Authorization") === `Bearer ${TOKEN}`;

    if (url.pathname === "/api/auth/login") {
      // Like the real API, emails are matched case-insensitively.
      return body.email.toLowerCase() === alice.email && body.password === PASSWORD
        ? json(200, { accessToken: TOKEN, expiresIn: 3600, user: alice })
        : json(401, { message: "Email hoặc mật khẩu không chính xác", statusCode: 401 });
    }
    if (url.pathname === "/api/auth/register") {
      return body.email === alice.email
        ? json(409, { message: "Email đã được đăng ký", statusCode: 409 })
        : json(201, { id: 2, email: body.email, displayName: body.displayName ?? null });
    }

    if (!authorized) return json(401, { message: "Unauthorized", statusCode: 401 });

    const id = Number(url.pathname.split("/")[3]);
    const index = tasks.findIndex((task) => task.id === id);
    if (url.pathname === "/api/tasks" && method === "GET") return json(200, tasks);
    if (url.pathname === "/api/tasks" && method === "POST") {
      const task = makeTask({ id: nextId++, ...body });
      tasks.push(task);
      return json(201, task);
    }
    if (index === -1) return json(404, { message: "Không tìm thấy công việc", statusCode: 404 });
    if (method === "PATCH") {
      tasks[index] = { ...tasks[index]!, ...body };
      return json(200, tasks[index]);
    }
    if (method === "DELETE") {
      tasks.splice(index, 1);
      return json(204);
    }
    return json(404, { message: "Not Found", statusCode: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, tasks };
}

/** The parsed JSON bodies of calls to one API path and method. */
export function requestsTo(
  fetchMock: ReturnType<typeof installFakeApi>["fetchMock"],
  path: string,
  method: string,
) {
  return fetchMock.mock.calls
    .filter(([input, init]) => input === path && (init?.method ?? "GET") === method)
    .map(([, init]) => (init?.body ? JSON.parse(init.body) : undefined));
}
