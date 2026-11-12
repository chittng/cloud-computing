import { apiRequest } from "@/lib/api";

export type TaskStatus = "pending" | "completed";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  /** Calendar date in "YYYY-MM-DD" form. */
  dueDate: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description: string | null;
  dueDate: string | null;
}

export type TaskPatch = Partial<TaskInput & { status: TaskStatus }>;

/** Sorted by the server: by due date, undated tasks last. */
export function fetchTasks(token: string): Promise<Task[]> {
  return apiRequest("/tasks", { token });
}

export function createTask(token: string, input: TaskInput): Promise<Task> {
  return apiRequest("/tasks", { method: "POST", body: input, token });
}

export function updateTask(token: string, id: number, patch: TaskPatch): Promise<Task> {
  return apiRequest(`/tasks/${id}`, { method: "PATCH", body: patch, token });
}

export function deleteTask(token: string, id: number): Promise<void> {
  return apiRequest(`/tasks/${id}`, { method: "DELETE", token });
}
