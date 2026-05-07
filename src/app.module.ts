import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { ScheduleModule } from '@nestjs/schedule';
import { TicketsModule } from './tickets/tickets.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        driver: PostgreSqlDriver as any,
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        dbName: config.get('DATABASE_NAME', 'ticketing'),
        user: config.get('DATABASE_USER', 'postgres'),
        password: config.get('DATABASE_PASSWORD', 'postgres'),
        autoLoadEntities: true,
        extensions: [Migrator],
        migrations: { path: './migrations' },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    TicketsModule,
    AdminModule,
    AuthModule,
  ],
})
export class AppModule {}
