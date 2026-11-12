import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { CreateTaskDto } from "./dto/create-task.dto.ts";
import type { UpdateTaskDto } from "./dto/update-task.dto.ts";
import { Task, type TaskStatus } from "./task.entity.ts";

/** Every operation is scoped to the owner; other users' tasks behave as if they do not exist. */
@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly tasks: Repository<Task>) {}

  /** Sorted by due date with undated tasks last, then by creation order. */
  findAll(userId: number, status?: TaskStatus): Promise<Task[]> {
    const query = this.tasks.createQueryBuilder("task").where("task.userId = :userId", { userId });
    if (status) query.andWhere("task.status = :status", { status });
    return query
      .orderBy("task.dueDate IS NULL", "ASC")
      .addOrderBy("task.dueDate", "ASC")
      .addOrderBy("task.id", "ASC")
      .getMany();
  }

  async findOne(userId: number, id: number): Promise<Task> {
    const task = await this.tasks.findOneBy({ id, userId });
    if (!task) throw new NotFoundException("Không tìm thấy công việc");
    return task;
  }

  async create(userId: number, dto: CreateTaskDto): Promise<Task> {
    const { id } = await this.tasks.save(this.tasks.merge(this.tasks.create({ userId }), dto));
    return this.findOne(userId, id);
  }

  async update(userId: number, id: number, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(userId, id);
    await this.tasks.save(this.tasks.merge(task, dto));
    return this.findOne(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const { affected } = await this.tasks.delete({ id, userId });
    if (!affected) throw new NotFoundException("Không tìm thấy công việc");
  }
}
