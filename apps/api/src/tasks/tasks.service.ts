import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ApiException, type FieldErrorDetail, validationError } from "../common/api-error.ts";
import {
  isValidDateOnlyString,
  parsePlainJsonObject,
  parsePositiveIntParam,
  pushDetail,
} from "../common/validation.ts";
import { TasksRepositoryPort } from "./tasks.repository.ts";
import type { TaskDto, TaskListResponse, TaskStatus, UpdateTaskFields } from "./tasks.types.ts";

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 10_000;
const TASK_NOT_FOUND_MESSAGE = "Không tìm thấy công việc";

function isValidStatus(value: unknown): value is TaskStatus {
  return value === "pending" || value === "completed";
}

/** Validates task inputs and enforces per-user ownership for all task operations. */
@Injectable()
export class TasksService {
  constructor(@Inject(TasksRepositoryPort) private readonly tasksRepository: TasksRepositoryPort) {}

  async createTask(userId: number, rawBody: unknown): Promise<TaskDto> {
    const body = parsePlainJsonObject(rawBody);
    const details: FieldErrorDetail[] = [];

    const title = this.validateRequiredTitle(body.title, details);
    const description = this.validateOptionalDescription(body.description, details);
    const dueDate = this.validateOptionalDueDate(body.due_date, details);

    let status: TaskStatus = "pending";
    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        pushDetail(details, "status", "Trạng thái chỉ nhận 'pending' hoặc 'completed'");
      } else {
        status = body.status;
      }
    }

    if (details.length > 0) {
      throw validationError(details);
    }

    return this.tasksRepository.createForUser({
      userId,
      title,
      description,
      dueDate,
      status,
    });
  }

  async listTasks(userId: number, rawQuery: Record<string, unknown>): Promise<TaskListResponse> {
    let statusFilter: TaskStatus | undefined;

    if (Object.hasOwn(rawQuery, "status")) {
      const statusParam = rawQuery.status;
      if (!isValidStatus(statusParam)) {
        throw validationError([
          { field: "status", message: "status chỉ hỗ trợ 'pending' hoặc 'completed'" },
        ]);
      }
      statusFilter = statusParam;
    }

    const items = await this.tasksRepository.listForUser(userId, statusFilter);
    return { items, count: items.length };
  }

  async getTaskById(userId: number, rawId: string): Promise<TaskDto> {
    const id = parsePositiveIntParam(rawId, "id");
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", TASK_NOT_FOUND_MESSAGE);
    }
    return task;
  }

  async updateTask(userId: number, rawId: string, rawBody: unknown): Promise<TaskDto> {
    const id = parsePositiveIntParam(rawId, "id");
    const body = parsePlainJsonObject(rawBody);
    const details: FieldErrorDetail[] = [];
    const fields: UpdateTaskFields = {};

    if (Object.hasOwn(body, "title")) {
      fields.title = this.validateRequiredTitle(body.title, details);
    }
    if (Object.hasOwn(body, "description")) {
      fields.description = this.validateOptionalDescription(body.description, details);
    }
    if (Object.hasOwn(body, "due_date")) {
      fields.dueDate = this.validateOptionalDueDate(body.due_date, details);
    }
    if (Object.hasOwn(body, "status")) {
      if (!isValidStatus(body.status)) {
        pushDetail(details, "status", "Trạng thái chỉ nhận 'pending' hoặc 'completed'");
      } else {
        fields.status = body.status;
      }
    }

    const hasUpdatableField =
      Object.hasOwn(body, "title") ||
      Object.hasOwn(body, "description") ||
      Object.hasOwn(body, "due_date") ||
      Object.hasOwn(body, "status");

    if (!hasUpdatableField) {
      pushDetail(
        details,
        "body",
        "Phải gửi ít nhất một trường hợp lệ (title, description, due_date hoặc status)",
      );
    }

    if (details.length > 0) {
      throw validationError(details);
    }

    const updated = await this.tasksRepository.updateForUser(id, userId, fields);
    if (!updated) {
      throw new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", TASK_NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async deleteTask(userId: number, rawId: string): Promise<void> {
    const id = parsePositiveIntParam(rawId, "id");
    const deleted = await this.tasksRepository.deleteForUser(id, userId);
    if (!deleted) {
      throw new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", TASK_NOT_FOUND_MESSAGE);
    }
  }

  private validateRequiredTitle(rawTitle: unknown, details: FieldErrorDetail[]): string {
    if (typeof rawTitle !== "string") {
      pushDetail(details, "title", "Tiêu đề phải là chuỗi ký tự");
      return "";
    }
    const trimmed = rawTitle.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_TITLE_LENGTH) {
      pushDetail(details, "title", "Tiêu đề phải từ 1 đến 255 ký tự");
      return "";
    }
    return trimmed;
  }

  private validateOptionalDescription(
    rawDesc: unknown,
    details: FieldErrorDetail[],
  ): string | null {
    if (rawDesc === undefined || rawDesc === null) {
      return null;
    }
    if (typeof rawDesc !== "string") {
      pushDetail(details, "description", "Mô tả phải là chuỗi ký tự hoặc null");
      return null;
    }
    if (rawDesc.length > MAX_DESCRIPTION_LENGTH) {
      pushDetail(details, "description", "Mô tả tối đa 10.000 ký tự");
      return null;
    }
    return rawDesc;
  }

  private validateOptionalDueDate(rawDate: unknown, details: FieldErrorDetail[]): string | null {
    if (rawDate === undefined || rawDate === null) {
      return null;
    }
    if (typeof rawDate !== "string" || !isValidDateOnlyString(rawDate)) {
      pushDetail(details, "due_date", "due_date phải là ngày hợp lệ theo định dạng YYYY-MM-DD");
      return null;
    }
    return rawDate;
  }
}
