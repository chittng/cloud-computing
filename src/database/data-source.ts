import "reflect-metadata";
import { DataSource } from "typeorm";
import type { DataSourceOptions } from "typeorm";
import { loadDatabaseOptions } from "./database-options.ts";

export async function connectDatabase(
  options: DataSourceOptions = loadDatabaseOptions(),
): Promise<DataSource> {
  const source = new DataSource(options);
  await source.initialize();
  try {
    // Every new pooled connection inherits the server's global time zone.
    const [settings] = await source.query<{ global_zone: string; session_zone: string }[]>(
      "SELECT @@global.time_zone AS global_zone, @@session.time_zone AS session_zone",
    );
    if (settings?.global_zone !== "+00:00" || settings.session_zone !== "+00:00") {
      throw new Error("MySQL must use default-time-zone='+00:00' for UTC timestamps");
    }
    return source;
  } catch (error) {
    await source.destroy();
    throw error;
  }
}
