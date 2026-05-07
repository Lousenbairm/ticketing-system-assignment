import { Tag } from 'antd';
import { STATUS_COLORS, STATUS_LABELS } from '../types/ticket.types';
import type { TicketStatus } from '../types/ticket.types';

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>;
}
