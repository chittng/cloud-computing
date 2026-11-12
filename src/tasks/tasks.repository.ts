import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ApiException } from "../common/api-error.ts";
import {
  extractMysqlErrorDetails,
  formatUtcIsoTimestamp,
  toSafePositiveId,
} from "../common/validation.ts";
import type { CreateTaskData, TaskDto, TaskStatus, UpdateTaskFields } from "./tasks.types.ts";

interface RawTaskRow {
  id: string | number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MysqlWriteHeader {
  insertId?: number | string | bigint;
  affectedRows?: number;
}

function mapTaskRow(row: RawTaskRow): TaskDto {
  return {
    id: toSafePositiveId(row.id),
    title: row.title,
    description: row.description,
    due_date: row.due_date,
    status: row.status,
    created_at: formatUtcIsoTimestamp(row.created_at),
    updated_at: formatUtcIsoTimestamp(row.updated_at),
  };
}

export abstract class TasksRepositoryPort {
  abstract createForUser(data: CreateTaskData): Promise<TaskDto>;
  abstract listForUser(userId: number, status?: TaskStatus): Promise<TaskDto[]>;
  abstract findByIdForUser(id: number, userId: number): Promise<TaskDto | null>;
  abstract updateForUser(
    id: number,
    userId: number,
    fields: UpdateTaskFields,
  ): Promise<TaskDto | null>;
  abstract deleteForUser(id: number, userId: number): Promise<boolean>;
}

/** MySQL-backed task persistence enforcing ownership filters and spec sort order. */
@Injectable()
export class MysqlTasksRepository extends TasksRepositoryPort {
  constructor(@Inject(DataSource) private readonly database: DataSource) {
    super();
  }

  async createForUser(data: CreateTaskData): Promise<TaskDto> {
    try {
      const result = await this.database.query<MysqlWriteHeader>(
        "INSERT INTO tasks (user_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?)",
        [data.userId, data.title, data.description, data.dueDate, data.status],
      );
      const insertedId = toSafePositiveId(result.insertId);
      const created = await this.findByIdForUser(insertedId, data.userId);
      if (!created) {
        throw new Error(`Failed to reload newly created task ${insertedId}`);
      }
      return created;
    } catch (error) {
      const mysqlError = extractMysqlErrorDetails(error);
      if (mysqlError.code === "ER_NO_REFERENCED_ROW_2" || mysqlError.errno === 1452) {
        throw new ApiException(
          HttpStatus.UNAUTHORIZED,
          "UNAUTHORIZED",
          "Tài khoản không còn tồn tại hoặc phiên đăng nhập không hợp lệ",
        );
      }
      throw error;
    }
  }

  async listForUser(userId: number, status?: TaskStatus): Promise<TaskDto[]> {
    const rows = status
      ? await this.database.query<RawTaskRow[]>(
          `SELECT id, title, description, due_date, status, created_at, updated_at
           FROM tasks
           WHERE user_id = ? AND status = ?
           ORDER BY due_date IS NULL ASC, due_date ASC, id ASC`,
          [userId, status],
        )
      : await this.database.query<RawTaskRow[]>(
          `SELECT id, title, description, due_date, status, created_at, updated_at
           FROM tasks
           WHERE user_id = ?
           ORDER BY due_date IS NULL ASC, due_date ASC, id ASC`,
          [userId],
        );

    return rows.map(mapTaskRow);
  }

  async findByIdForUser(id: number, userId: number): Promise<TaskDto | null> {
    const rows = await this.database.query<RawTaskRow[]>(
      `SELECT id, title, description, due_date, status, created_at, updated_at
       FROM tasks
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId],
    );
    const row = rows[0];
    return row ? mapTaskRow(row) : null;
  }

  async updateForUser(
    id: number,
    userId: number,
    fields: UpdateTaskFields,
  ): Promise<TaskDto | null> {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) {
      return null;
    }

    const assignments: string[] = [];
    const params: unknown[] = [];

    if (fields.title !== undefined) {
      assignments.push("title = ?");
      params.push(fields.title);
    }
    if (fields.description !== undefined) {
      assignments.push("description = ?");
      params.push(fields.description);
    }
    if (fields.dueDate !== undefined) {
      assignments.push("due_date = ?");
      params.push(fields.dueDate);
    }
    if (fields.status !== undefined) {
      assignments.push("status = ?");
      params.push(fields.status);
    }

    if (assignments.length === 0) {
      return existing;
    }

    params.push(id, userId);
    await this.database.query(
      `UPDATE tasks SET ${assignments.join(", ")} WHERE id = ? AND user_id = ?`,
      params,
    );

    return this.findByIdForUser(id, userId);
  }

  async deleteForUser(id: number, userId: number): Promise<boolean> {
    const result = await this.database.query<MysqlWriteHeader>(
      "DELETE FROM tasks WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    return Number(result.affectedRows ?? 0) > 0;
  }
}
