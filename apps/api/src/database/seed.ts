// Creates two sample accounts with one task each. Safe to rerun: existing accounts are skipped.
import { hash } from "bcryptjs";
import { Task } from "../tasks/task.entity.ts";
import { User } from "../users/user.entity.ts";
import dataSource from "./data-source.ts";

const password = process.env.SEED_PASSWORD ?? "";
const bytes = Buffer.byteLength(password, "utf8");
if (bytes < 8 || bytes > 72) {
  throw new Error("SEED_PASSWORD must be 8 to 72 bytes long");
}

const samples = [
  { name: "Alice", status: "pending" },
  { name: "Bob", status: "completed" },
] as const;

await dataSource.initialize();
try {
  const passwordHash = await hash(password, 12);
  await dataSource.transaction(async (manager) => {
    for (const { name, status } of samples) {
      const email = `${name.toLowerCase()}.seed@example.test`;
      if (await manager.existsBy(User, { email })) continue;

      const user = await manager.save(
        manager.create(User, { email, password: passwordHash, displayName: name }),
      );
      await manager.save(
        manager.create(Task, {
          userId: user.id,
          title: `${name}'s sample task`,
          description: "Sample data",
          status,
        }),
      );
    }
  });
  console.log("Sample users and tasks are ready");
} finally {
  await dataSource.destroy();
}
