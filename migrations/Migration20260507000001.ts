import { Migration } from '@mikro-orm/migrations';

export class Migration20260507000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "ticket"
        add column "deleted_at" timestamptz null,
        add column "deleted_by" varchar(255) null,
        add column "modified_by" varchar(255) null;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      alter table "ticket"
        drop column "deleted_at",
        drop column "deleted_by",
        drop column "modified_by";
    `);
  }
}
