import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

const VALID_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus>> = {
  [TicketStatus.OPEN]: TicketStatus.IN_PROGRESS,
  [TicketStatus.IN_PROGRESS]: TicketStatus.RESOLVED,
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: EntityRepository<Ticket>,
    private readonly em: EntityManager,
  ) {}

  async create(dto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketRepo.create({
      ...dto,
      status: TicketStatus.OPEN,
    });
    this.em.persist(ticket);
    await this.em.flush();
    return ticket;
  }

  async findAll(query: ListTicketsDto): Promise<Ticket[]> {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.$or = [
        { title: { $ilike: `%${query.q}%` } },
        { description: { $ilike: `%${query.q}%` } },
      ];
    }
    return this.ticketRepo.findAll({ where, orderBy: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne(id);
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (dto.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Tickets are auto-closed by the scheduler only');
    }

    if (VALID_TRANSITIONS[ticket.status] !== dto.status) {
      const allowed = VALID_TRANSITIONS[ticket.status] ?? 'none';
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${dto.status}. Allowed: ${allowed}`,
      );
    }

    ticket.status = dto.status;
    if (dto.status === TicketStatus.RESOLVED) ticket.resolvedAt = new Date();

    await this.em.flush();
    return ticket;
  }

  async autoCloseResolved(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const tickets = await this.ticketRepo.find({
      status: TicketStatus.RESOLVED,
      resolvedAt: { $lte: cutoff },
    });

    tickets.forEach(t => (t.status = TicketStatus.CLOSED));
    if (tickets.length) await this.em.flush();
    return tickets.length;
  }
}
