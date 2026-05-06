import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Ticket } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsScheduler } from './tickets.scheduler';

@Module({
  imports: [MikroOrmModule.forFeature([Ticket])],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsScheduler],
})
export class TicketsModule {}
