export type TaskStatus = "pending" | "completed";

export interface TaskDto {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  items: TaskDto[];
  count: number;
}

export interface CreateTaskData {
  userId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
}

export interface UpdateTaskFields {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
}
