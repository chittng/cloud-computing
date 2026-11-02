import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.ts";

@Module({ imports: [DatabaseModule] })
export class RootModule {}
