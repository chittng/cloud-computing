import { connectDatabase } from "./data-source.ts";

const action = process.argv[2];
if (action !== "up" && action !== "down") {
  throw new Error("Usage: migrate.js <up|down>");
}

const source = await connectDatabase();
try {
  if (action === "up") {
    const migrations = await source.runMigrations();
    console.log(`Applied ${migrations.length} migration(s)`);
  } else {
    await source.undoLastMigration();
    console.log("Reverted the last migration");
  }
} finally {
  await source.destroy();
}
