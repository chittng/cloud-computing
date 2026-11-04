
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
    const [settings] = await source.query<
      { global_zone: string; session_zone: string }[]
    >(
      "SELECT @@global.time_zone AS global_zone, @@session.time_zone AS session_zone",
    );

    const isUtc = (zone: string | undefined): boolean =>
      typeof zone === "string" &&
      ["UTC", "+00:00"].includes(zone.trim().toUpperCase());

    if (!isUtc(settings?.global_zone) || !isUtc(settings?.session_zone)) {
      throw new Error(
        "MySQL must use UTC ('UTC' or '+00:00') for UTC timestamps",
      );
    }

    return source;
  } catch (error) {
    await source.destroy();
    throw error;
  }
}

