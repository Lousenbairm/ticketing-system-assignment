export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Ticket {
  id: string;
  title: string;
  customerName: string;
  customerEmail: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  modifiedBy?: string | null;
}

export interface CreateTicketPayload {
  title: string;
  customerName: string;
  customerEmail: string;
  description: string;
  priority?: TicketPriority;
}

export const NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: null,
  CLOSED: null,
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'orange',
  RESOLVED: 'green',
  CLOSED: 'default',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'default',
  MEDIUM: 'gold',
  HIGH: 'red',
};
