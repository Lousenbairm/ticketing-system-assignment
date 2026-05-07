import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Admin } from './entities/admin.entity';
import { AdminSeeder } from './admin.seeder';

@Module({
  imports: [MikroOrmModule.forFeature([Admin])],
  providers: [AdminSeeder],
  exports: [AdminSeeder],
})
export class AdminModule {}
