import { create } from 'zustand';
import { ticketsApi } from '../api/tickets';
import type { Ticket, CreateTicketPayload, TicketStatus } from '../types/ticket.types';

interface TicketState {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  loading: boolean;
  error: string | null;
  statusFilter: TicketStatus | undefined;
  searchQuery: string;
  includeDeleted: boolean;

  fetchTickets: (status?: TicketStatus, q?: string, includeDeleted?: boolean) => Promise<void>;
  fetchTicket: (id: string) => Promise<void>;
  createTicket: (payload: CreateTicketPayload) => Promise<void>;
  updateStatus: (id: string, status: TicketStatus) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  setFilter: (status: TicketStatus | undefined) => void;
  setSearch: (q: string) => void;
  setIncludeDeleted: (val: boolean) => void;
  clearError: () => void;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  selectedTicket: null,
  loading: false,
  error: null,
  statusFilter: undefined,
  searchQuery: '',
  includeDeleted: false,

  fetchTickets: async (status?, q?, includeDeleted?) => {
    set({ loading: true, error: null });
    try {
      const tickets = await ticketsApi.list(status, q, includeDeleted);
      set({ tickets, loading: false });
    } catch {
      set({ error: 'Failed to load tickets', loading: false });
    }
  },

  fetchTicket: async (id) => {
    set({ loading: true, error: null, selectedTicket: null });
    try {
      const ticket = await ticketsApi.get(id);
      set({ selectedTicket: ticket, loading: false });
    } catch {
      set({ error: 'Ticket not found', loading: false });
    }
  },

  createTicket: async (payload) => {
    try {
      const ticket = await ticketsApi.create(payload);
      set(s => ({ tickets: [ticket, ...s.tickets] }));
    } catch (err) {
      throw err;
    }
  },

  updateStatus: async (id, status) => {
    try {
      const updated = await ticketsApi.updateStatus(id, status);
      set(s => ({
        selectedTicket: updated,
        tickets: s.tickets.map(t => t.id === id ? updated : t),
      }));
    } catch {
      set({ error: 'Failed to update status' });
    }
  },

  deleteTicket: async (id) => {
    try {
      await ticketsApi.softDelete(id);
      set(s => ({ tickets: s.tickets.filter(t => t.id !== id), selectedTicket: null }));
    } catch {
      set({ error: 'Failed to delete ticket' });
    }
  },

  setFilter: (status) => {
    set({ statusFilter: status });
    get().fetchTickets(status, get().searchQuery, get().includeDeleted);
  },

  setSearch: (q) => {
    set({ searchQuery: q });
    get().fetchTickets(get().statusFilter, q, get().includeDeleted);
  },

  setIncludeDeleted: (val) => {
    set({ includeDeleted: val });
    get().fetchTickets(get().statusFilter, get().searchQuery, val);
  },

  clearError: () => set({ error: null }),
}));
