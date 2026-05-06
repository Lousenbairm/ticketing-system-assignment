import { Entity, Enum, Opt, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Entity()
export class Ticket {
  @PrimaryKey({ type: 'uuid' })
  id: string & Opt = uuidv4();

  @Property()
  title!: string;

  @Property()
  customerName!: string;

  @Property()
  customerEmail!: string;

  @Property({ type: 'text' })
  description!: string;

  @Enum(() => TicketStatus)
  status: TicketStatus & Opt = TicketStatus.OPEN;

  @Enum(() => TicketPriority)
  priority: TicketPriority & Opt = TicketPriority.MEDIUM;

  @Property()
  createdAt: Date & Opt = new Date();

  @Property({ nullable: true })
  resolvedAt?: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date & Opt = new Date();
}
