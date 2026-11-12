import { Logger, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { loadDatabaseOptions } from "./database-options.ts";
import { connectDatabase } from "./data-source.ts";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...loadDatabaseOptions(), retryAttempts: 1 }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error("Database options are required");
        const source = await connectDatabase(options);
        new Logger("DatabaseModule").log("Connected to MySQL (UTC)");
        return source;
      },
    }),
  ],
})
export class DatabaseModule {}
