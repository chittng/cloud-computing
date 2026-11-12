import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, CurrentUser } from "../auth/auth.guard.ts";
import type { AuthenticatedUser } from "../auth/auth.types.ts";
import { TasksService } from "./tasks.service.ts";
import type { TaskDto, TaskListResponse } from "./tasks.types.ts";

@Controller("api/v1/tasks")
@UseGuards(AuthGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TaskDto> {
    const created = await this.tasksService.createTask(user.id, body);
    response.setHeader("Location", `/api/v1/tasks/${created.id}`);
    return created;
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ): Promise<TaskListResponse> {
    return this.tasksService.listTasks(user.id, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<TaskDto> {
    return this.tasksService.getTaskById(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<TaskDto> {
    return this.tasksService.updateTask(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.tasksService.deleteTask(user.id, id);
  }
}
