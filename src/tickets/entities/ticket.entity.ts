import { defineEntity, InferEntity, p } from '@mikro-orm/core';
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

export const Ticket = defineEntity({
  name: 'Ticket',
  properties: {
    id: p.uuid().primary().onCreate(() => uuidv4()),
    title: p.string(),
    customerName: p.string(),
    customerEmail: p.string(),
    description: p.text(),
    status: p.enum(() => TicketStatus).default(TicketStatus.OPEN),
    priority: p.enum(() => TicketPriority).default(TicketPriority.MEDIUM),
    createdAt: p.type(Date).onCreate(() => new Date()),
    resolvedAt: p.type(Date).nullable(),
    updatedAt: p.type(Date).onUpdate(() => new Date()).onCreate(() => new Date()),
  },
});

// Ticket as value = entity schema (for DI tokens, forFeature, etc.)
// Ticket as type = entity instance shape (for type annotations)
export type Ticket = InferEntity<typeof Ticket>;
