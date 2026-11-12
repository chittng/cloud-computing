import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDto } from "./create-task.dto.ts";

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
