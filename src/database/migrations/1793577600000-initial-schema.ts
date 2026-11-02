import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793577600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id BIGINT NOT NULL AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT ck_users_email_not_blank CHECK (CHAR_LENGTH(TRIM(email)) > 0)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE tasks (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        due_date DATE NULL,
        status VARCHAR(20) COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT ck_tasks_status CHECK (status IN ('pending', 'completed')),
        CONSTRAINT ck_tasks_title_not_blank CHECK (CHAR_LENGTH(TRIM(title)) > 0),
        INDEX idx_tasks_user_status_due (user_id, status, due_date),
        INDEX idx_tasks_user_due (user_id, due_date)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE tasks");
    await queryRunner.query("DROP TABLE users");
  }
}
