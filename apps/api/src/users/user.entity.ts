import { Exclude } from "class-transformer";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  /** bcrypt hash; never serialized and only loaded when explicitly selected. */
  @Exclude()
  @Column({ type: "varchar", length: 255, select: false })
  password: string;

  @Column({ name: "display_name", type: "varchar", length: 100, nullable: true })
  displayName: string | null;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt: Date;
}
