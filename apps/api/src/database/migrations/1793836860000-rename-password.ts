import type { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePassword1793836860000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users RENAME COLUMN password_hash TO password");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users RENAME COLUMN password TO password_hash");
  }
}
