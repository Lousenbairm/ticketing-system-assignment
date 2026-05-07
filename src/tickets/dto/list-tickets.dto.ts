import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TicketStatus } from '../entities/ticket.entity';

export class ListTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeDeleted?: boolean;
}
