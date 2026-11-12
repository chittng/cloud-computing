import { beforeEach, describe, expect, it } from "vitest";
import { TasksRepositoryPort } from "./tasks.repository.ts";
import { TasksService } from "./tasks.service.ts";
import type { CreateTaskData, TaskDto, TaskStatus, UpdateTaskFields } from "./tasks.types.ts";

class InMemoryTasksRepo extends TasksRepositoryPort {
  private nextId = 1;
  private tasks: Array<TaskDto & { userId: number; updateTick: number }> = [];
  private tick = 1;

  async createForUser(data: CreateTaskData): Promise<TaskDto> {
    const now = `2026-11-11T00:00:0${this.tick++}.000Z`;
    const record = {
      id: this.nextId++,
      userId: data.userId,
      title: data.title,
      description: data.description,
      due_date: data.dueDate,
      status: data.status,
      created_at: now,
      updated_at: now,
      updateTick: this.tick,
    };
    this.tasks.push(record);
    return this.toDto(record);
  }

  async listForUser(userId: number, status?: TaskStatus): Promise<TaskDto[]> {
    return this.tasks
      .filter((t) => t.userId === userId && (!status || t.status === status))
      .sort((a, b) => {
        if (a.due_date === null && b.due_date !== null) return 1;
        if (a.due_date !== null && b.due_date === null) return -1;
        if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return a.id - b.id;
      })
      .map((t) => this.toDto(t));
  }

  async findByIdForUser(id: number, userId: number): Promise<TaskDto | null> {
    const found = this.tasks.find((t) => t.id === id && t.userId === userId);
    return found ? this.toDto(found) : null;
  }

  async updateForUser(
    id: number,
    userId: number,
    fields: UpdateTaskFields,
  ): Promise<TaskDto | null> {
    const found = this.tasks.find((t) => t.id === id && t.userId === userId);
    if (!found) return null;

    let changed = false;
    if (fields.title !== undefined && fields.title !== found.title) {
      found.title = fields.title;
      changed = true;
    }
    if (fields.description !== undefined && fields.description !== found.description) {
      found.description = fields.description;
      changed = true;
    }
    if (fields.dueDate !== undefined && fields.dueDate !== found.due_date) {
      found.due_date = fields.dueDate;
      changed = true;
    }
    if (fields.status !== undefined && fields.status !== found.status) {
      found.status = fields.status;
      changed = true;
    }

    if (changed) {
      found.updated_at = `2026-11-11T00:00:0${Math.min(9, this.tick++)}.000Z`;
    }
    return this.toDto(found);
  }

  async deleteForUser(id: number, userId: number): Promise<boolean> {
    const idx = this.tasks.findIndex((t) => t.id === id && t.userId === userId);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    return true;
  }

  private toDto(task: TaskDto & { userId: number }): TaskDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };
  }
}

describe("TasksService", () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService(new InMemoryTasksRepo());
  });

  it("validates create fields, due_date calendar validity, and ignores extra user_id", async () => {
    const created = await service.createTask(10, {
      title: "  Nộp báo cáo  ",
      description: "Chi tiết",
      due_date: "2020-01-15",
      user_id: 999,
      unknown: "ignored",
    });

    expect(created).toMatchObject({
      id: 1,
      title: "Nộp báo cáo",
      description: "Chi tiết",
      due_date: "2020-01-15",
      status: "pending",
    });
    expect("user_id" in created).toBe(false);

    // Owner 10 sees task, user 11 does not
    await expect(service.getTaskById(11, "1")).rejects.toMatchObject({
      status: 404,
      code: "TASK_NOT_FOUND",
    });

    await expect(
      service.createTask(10, { title: "Bad date", due_date: "2026-02-30" }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });

    await expect(service.createTask(10, { title: "   " })).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });

    await expect(
      service.createTask(10, { title: "Case check", status: "PENDING" }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });

  it("validates list status filter and positive integer id params", async () => {
    await expect(service.listTasks(10, { status: "PENDING" })).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    await expect(service.getTaskById(10, "0")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    await expect(service.getTaskById(10, "abc")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("updates partial fields, clears nullable fields, preserves unchanged updated_at, and rejects empty PATCH", async () => {
    const task = await service.createTask(1, {
      title: "Task 1",
      description: "Initial",
      due_date: "2026-12-01",
    });

    await expect(
      service.updateTask(1, String(task.id), { id: 99, user_id: 2, updated_at: "2000-01-01" }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });

    // Resend identical title -> updated_at unchanged and succeeds (not 404)
    const unchanged = await service.updateTask(1, String(task.id), { title: "Task 1" });
    expect(unchanged.updated_at).toBe(task.updated_at);

    // Clear nullable description and due_date and mark completed
    const updated = await service.updateTask(1, String(task.id), {
      description: null,
      due_date: null,
      status: "completed",
    });
    expect(updated).toMatchObject({
      id: task.id,
      title: "Task 1",
      description: null,
      due_date: null,
      status: "completed",
    });
    expect(updated.updated_at).not.toBe(task.updated_at);
  });
});
