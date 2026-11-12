import { hash } from "bcryptjs";
import type { DataSource } from "typeorm";

export async function seedData(database: DataSource, password: string): Promise<void> {
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 8 || bytes > 72) throw new Error("SEED_PASSWORD must contain 8 to 72 UTF-8 bytes");
  const passwordHash = await hash(password, 12);
  await database.transaction(async (manager) => {
    for (const name of ["Alice", "Bob"]) {
      const email = `${name.toLowerCase()}.seed@example.test`;
      const existing = await manager.query<unknown[]>("SELECT id FROM users WHERE email = ?", [
        email,
      ]);
      if (existing.length) continue;
      await manager.query("INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)", [
        email,
        passwordHash,
        name,
      ]);
      await manager.query(
        `INSERT INTO tasks (user_id, title, description, status)
        SELECT id, ?, ?, ? FROM users WHERE email = ?`,
        [
          `${name}'s sample task`,
          "Sample data created by CLOUD-13",
          name === "Alice" ? "pending" : "completed",
          email,
        ],
      );
    }
  });
}
