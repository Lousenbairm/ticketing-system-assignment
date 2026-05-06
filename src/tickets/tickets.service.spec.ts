// Must mock ESM-only MikroORM packages before any imports.
// @mikro-orm/core uses import.meta which breaks Jest CJS mode.
jest.mock('@mikro-orm/nestjs', () => ({
  InjectRepository: () => () => {},
}));

jest.mock('@mikro-orm/core', () => {
  const noop = () => () => {};
  return {
    Entity: noop,
    Property: noop,
    PrimaryKey: noop,
    Enum: noop,
    EntityRepository: class {},
    EntityManager: class {},
  };
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket, TicketPriority, TicketStatus } from './entities/ticket.entity';

const makeRepo = () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
});

const makeEm = () => ({
  persist: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
});

describe('TicketsService', () => {
  let service: TicketsService;
  let repo: ReturnType<typeof makeRepo>;
  let em: ReturnType<typeof makeEm>;

  beforeEach(() => {
    repo = makeRepo();
    em = makeEm();
    service = new TicketsService(repo as any, em as any);
  });

  describe('create', () => {
    it('sets status=OPEN and priority=MEDIUM by default', async () => {
      const ticket = { status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM } as Ticket;
      repo.create.mockReturnValue(ticket);

      const result = await service.create({
        title: 'T',
        customerName: 'N',
        customerEmail: 'e@e.com',
        description: 'D',
      });

      expect(result.status).toBe(TicketStatus.OPEN);
      expect(result.priority).toBe(TicketPriority.MEDIUM);
      expect(em.flush).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('OPEN → IN_PROGRESS succeeds', async () => {
      const ticket = { status: TicketStatus.OPEN } as Ticket;
      repo.findOne.mockResolvedValue(ticket);

      const result = await service.updateStatus('id', { status: TicketStatus.IN_PROGRESS });
      expect(result.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('OPEN → RESOLVED throws (skipped step)', async () => {
      repo.findOne.mockResolvedValue({ status: TicketStatus.OPEN } as Ticket);
      await expect(
        service.updateStatus('id', { status: TicketStatus.RESOLVED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('any → CLOSED throws with scheduler message', async () => {
      repo.findOne.mockResolvedValue({ status: TicketStatus.IN_PROGRESS } as Ticket);
      await expect(
        service.updateStatus('id', { status: TicketStatus.CLOSED }),
      ).rejects.toThrow('scheduler');
    });

    it('IN_PROGRESS → RESOLVED sets resolvedAt', async () => {
      const ticket = { status: TicketStatus.IN_PROGRESS } as Ticket;
      repo.findOne.mockResolvedValue(ticket);

      const result = await service.updateStatus('id', { status: TicketStatus.RESOLVED });
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('autoCloseResolved', () => {
    it('closes ticket with resolvedAt older than threshold', async () => {
      const old = new Date();
      old.setDate(old.getDate() - 4);
      const ticket = { status: TicketStatus.RESOLVED, resolvedAt: old } as Ticket;
      repo.find.mockResolvedValue([ticket]);

      const count = await service.autoCloseResolved(3);
      expect(ticket.status).toBe(TicketStatus.CLOSED);
      expect(count).toBe(1);
    });

    it('returns 0 and skips flush when no tickets match', async () => {
      repo.find.mockResolvedValue([]);

      const count = await service.autoCloseResolved(3);
      expect(count).toBe(0);
      expect(em.flush).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when ticket missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
