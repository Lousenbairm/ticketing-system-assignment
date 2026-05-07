import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { AppModule } from './app.module';
import { AdminSeeder } from './admin/admin.seeder';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: 'http://localhost:5173' });
  await app.get(MikroORM).migrator.up();
  await app.get(AdminSeeder).seed();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
