import { Exclude } from "class-transformer";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const TASK_STATUSES = ["pending", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

@Entity("tasks")
export class Task {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Exclude()
  @Column({ name: "user_id", type: "bigint" })
  userId: number;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  /** Calendar date in "YYYY-MM-DD" form. */
  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate: string | null;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: TaskStatus;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt: Date;
}
