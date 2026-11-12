import { Transform } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { TASK_STATUSES, type TaskStatus } from "../task.entity.ts";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim)
  @IsString({ message: "Tiêu đề phải là chuỗi ký tự" })
  @IsNotEmpty({ message: "Vui lòng nhập tiêu đề" })
  @MaxLength(255, { message: "Tiêu đề tối đa 255 ký tự" })
  title: string;

  @IsOptional()
  @IsString({ message: "Mô tả phải là chuỗi ký tự" })
  @MaxLength(10_000, { message: "Mô tả tối đa 10.000 ký tự" })
  description?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Hạn chót phải có dạng YYYY-MM-DD" })
  @IsISO8601({ strict: true }, { message: "Hạn chót không phải ngày hợp lệ" })
  dueDate?: string | null;

  @IsOptional()
  @IsIn(TASK_STATUSES, { message: "Trạng thái phải là pending hoặc completed" })
  status?: TaskStatus;
}
