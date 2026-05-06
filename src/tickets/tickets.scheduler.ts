import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TicketsService } from './tickets.service';

@Injectable()
export class TicketsScheduler {
  private readonly logger = new Logger(TicketsScheduler.name);

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 2 * * *')
  async handleAutoClose(): Promise<void> {
    const days = Number(this.configService.get<number>('AUTO_CLOSE_DAYS', 3));
    this.logger.log(`Auto-close cron started. Threshold: ${days} days`);
    const closed = await this.ticketsService.autoCloseResolved(days);
    this.logger.log(`Auto-close cron completed. Tickets closed: ${closed}`);
  }
}
