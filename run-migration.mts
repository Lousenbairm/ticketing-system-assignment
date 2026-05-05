import { MikroORM } from '@mikro-orm/core';
// tsx resolves .js → .ts at runtime
import config from './mikro-orm.config.js';

const orm = await MikroORM.init(config);
try {
  const migrator = orm.getMigrator();
  await migrator.up();
  console.log('Migrations applied.');
} finally {
  await orm.close();
}
