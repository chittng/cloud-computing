import { connectDatabase } from "./data-source.ts";
import { seedData } from "./seed-data.ts";

const database = await connectDatabase();
try {
  await seedData(database, process.env.SEED_PASSWORD ?? "");
  console.log("Sample users and tasks are ready");
} finally {
  await database.destroy();
}
