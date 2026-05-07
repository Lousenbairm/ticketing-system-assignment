import { Tag } from 'antd';
import { PRIORITY_COLORS } from '../types/ticket.types';
import type { TicketPriority } from '../types/ticket.types';

export default function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Tag color={PRIORITY_COLORS[priority]}>{priority}</Tag>;
}
