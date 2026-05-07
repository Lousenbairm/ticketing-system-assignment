import { Migration } from '@mikro-orm/migrations';

export class Migration20260507000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "admin" (
        "id" uuid not null,
        "username" varchar(255) not null,
        "password_hash" varchar(255) not null,
        "created_at" timestamptz not null,
        constraint "admin_pkey" primary key ("id"),
        constraint "admin_username_unique" unique ("username")
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "admin" cascade;');
  }
}
