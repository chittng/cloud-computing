import type { MigrationInterface, QueryRunner } from "typeorm";

export class UnicodeCollation1793836800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await this.setCollation(queryRunner, "utf8mb4_unicode_ci");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.setCollation(queryRunner, "utf8mb4_0900_ai_ci");
  }

  private async setCollation(
    queryRunner: QueryRunner,
    collation: "utf8mb4_unicode_ci" | "utf8mb4_0900_ai_ci",
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DEFAULT CHARACTER SET utf8mb4 COLLATE ${collation},
        MODIFY email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE ${collation} NOT NULL,
        MODIFY password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE ${collation} NOT NULL,
        MODIFY display_name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE ${collation} NULL
    `);
    // Keep status on utf8mb4_bin so its CHECK remains case-sensitive.
    await queryRunner.query(`
      ALTER TABLE tasks
        DEFAULT CHARACTER SET utf8mb4 COLLATE ${collation},
        MODIFY title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE ${collation} NOT NULL,
        MODIFY description TEXT CHARACTER SET utf8mb4 COLLATE ${collation} NULL
    `);
    await queryRunner.query(`ALTER DATABASE CHARACTER SET utf8mb4 COLLATE ${collation}`);
  }
}
