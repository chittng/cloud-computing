import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser, type JwtPayload } from "../auth/current-user.decorator.ts";
import { CreateTaskDto } from "./dto/create-task.dto.ts";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto.ts";
import { UpdateTaskDto } from "./dto/update-task.dto.ts";
import { TasksService } from "./tasks.service.ts";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListTasksQueryDto) {
    return this.tasksService.findAll(user.sub, query.status);
  }

  @Get(":id")
  findOne(@CurrentUser() user: JwtPayload, @Param("id", ParseIntPipe) id: number) {
    return this.tasksService.findOne(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.sub, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param("id", ParseIntPipe) id: number) {
    return this.tasksService.remove(user.sub, id);
  }
}
