import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.ts";
import { DatabaseModule } from "../database/database.module.ts";
import { TasksController } from "./tasks.controller.ts";
import { MysqlTasksRepository, TasksRepositoryPort } from "./tasks.repository.ts";
import { TasksService } from "./tasks.service.ts";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: TasksRepositoryPort,
      useClass: MysqlTasksRepository,
    },
  ],
})
export class TasksModule {}
