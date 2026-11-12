import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { User } from "./user.entity.ts";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Includes the password hash, which is not selected by default. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email },
      select: { id: true, email: true, password: true, displayName: true },
    });
  }

  async create(data: Pick<User, "email" | "password" | "displayName">): Promise<User> {
    try {
      const { id } = await this.users.save(this.users.create(data));
      return await this.users.findOneByOrFail({ id });
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "ER_DUP_ENTRY") {
        throw new ConflictException("Email đã được đăng ký");
      }
      throw error;
    }
  }
}
