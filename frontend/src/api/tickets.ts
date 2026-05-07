import axios from 'axios';
import type { Ticket, CreateTicketPayload, TicketStatus } from '../types/ticket.types';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(err);
  }
);

export const ticketsApi = {
  list: (status?: TicketStatus, q?: string, includeDeleted?: boolean) =>
    api.get<Ticket[]>('/tickets', { params: { status, q, includeDeleted } }).then(r => r.data),

  get: (id: string) =>
    api.get<Ticket>(`/tickets/${id}`).then(r => r.data),

  create: (payload: CreateTicketPayload) =>
    api.post<Ticket>('/tickets', payload).then(r => r.data),

  updateStatus: (id: string, status: TicketStatus) =>
    api.put<Ticket>(`/tickets/${id}/status`, { status }).then(r => r.data),

  softDelete: (id: string) =>
    api.delete<Ticket>(`/tickets/${id}`).then(r => r.data),
};
