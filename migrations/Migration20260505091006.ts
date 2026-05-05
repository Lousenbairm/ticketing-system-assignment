import { Migration } from '@mikro-orm/migrations';

export class Migration20260505091006 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create type "ticket_status" as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
      create type "ticket_priority" as enum ('LOW', 'MEDIUM', 'HIGH');
      create table "ticket" (
        "id" uuid not null,
        "title" varchar(255) not null,
        "customer_name" varchar(255) not null,
        "customer_email" varchar(255) not null,
        "description" text not null,
        "status" "ticket_status" not null default 'OPEN',
        "priority" "ticket_priority" not null default 'MEDIUM',
        "created_at" timestamptz not null,
        "resolved_at" timestamptz null,
        "updated_at" timestamptz not null,
        constraint "ticket_pkey" primary key ("id")
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "ticket" cascade;');
    this.addSql('drop type if exists "ticket_priority";');
    this.addSql('drop type if exists "ticket_status";');
  }
}
