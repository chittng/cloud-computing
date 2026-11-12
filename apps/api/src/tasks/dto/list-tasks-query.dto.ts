import { IsIn, IsOptional } from "class-validator";
import { TASK_STATUSES, type TaskStatus } from "../task.entity.ts";

export class ListTasksQueryDto {
  @IsOptional()
  @IsIn(TASK_STATUSES, { message: "Trạng thái phải là pending hoặc completed" })
  status?: TaskStatus;
}
