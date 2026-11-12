import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ApiException } from "../common/api-error.ts";
import {
  extractMysqlErrorDetails,
  formatUtcIsoTimestamp,
  toSafePositiveId,
} from "../common/validation.ts";
import type { AuthenticatedUser, RegisterResponse, UserAuthRecord } from "./auth.types.ts";

interface RawUserRow {
  id: string | number;
  email: string;
  password?: string;
  display_name: string | null;
  created_at: Date | string;
}

interface MysqlInsertHeader {
  insertId?: number | string | bigint;
}

export abstract class AuthRepositoryPort {
  abstract findByEmail(email: string): Promise<UserAuthRecord | null>;
  abstract findById(id: number): Promise<AuthenticatedUser | null>;
  abstract createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string | null;
  }): Promise<RegisterResponse>;
}

/** MySQL-backed user lookup and persistence using parameterized TypeORM queries. */
@Injectable()
export class MysqlAuthRepository extends AuthRepositoryPort {
  constructor(@Inject(DataSource) private readonly database: DataSource) {
    super();
  }

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    const rows = await this.database.query<RawUserRow[]>(
      "SELECT id, email, password, display_name, created_at FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    const row = rows[0];
    if (!row || typeof row.password !== "string") {
      return null;
    }

    return {
      id: toSafePositiveId(row.id),
      email: row.email,
      passwordHash: row.password,
      displayName: row.display_name,
      createdAt: formatUtcIsoTimestamp(row.created_at),
    };
  }

  async findById(id: number): Promise<AuthenticatedUser | null> {
    const rows = await this.database.query<RawUserRow[]>(
      "SELECT id, email, display_name FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: toSafePositiveId(row.id),
      email: row.email,
      display_name: row.display_name,
    };
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string | null;
  }): Promise<RegisterResponse> {
    try {
      const insertResult = await this.database.query<MysqlInsertHeader>(
        "INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)",
        [input.email, input.passwordHash, input.displayName],
      );
      const insertedId = toSafePositiveId(insertResult.insertId);
      const rows = await this.database.query<RawUserRow[]>(
        "SELECT id, email, display_name, created_at FROM users WHERE id = ? LIMIT 1",
        [insertedId],
      );
      const created = rows[0];
      if (!created) {
        throw new Error(`Failed to reload newly created user ${insertedId}`);
      }

      return {
        id: toSafePositiveId(created.id),
        email: created.email,
        display_name: created.display_name,
        created_at: formatUtcIsoTimestamp(created.created_at),
      };
    } catch (error) {
      const mysqlError = extractMysqlErrorDetails(error);
      if (mysqlError.code === "ER_DUP_ENTRY" || mysqlError.errno === 1062) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "EMAIL_ALREADY_EXISTS",
          "Email đã được đăng ký",
        );
      }
      throw error;
    }
  }
}
