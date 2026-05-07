import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { Ticket } from './entities/ticket.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTicketDto): Promise<Ticket> {
    return this.ticketsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() query: ListTicketsDto): Promise<Ticket[]> {
    return this.ticketsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Ticket> {
    return this.ticketsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @Req() req: any,
  ): Promise<Ticket> {
    return this.ticketsService.updateStatus(id, dto, req.user.username);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<Ticket> {
    return this.ticketsService.softDelete(id, req.user.username);
  }
}
