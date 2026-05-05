import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketStatus } from '../entities/ticket.entity';

export class ListTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  q?: string;
}
