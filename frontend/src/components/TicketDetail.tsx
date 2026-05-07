import { useEffect } from 'react';
import { Descriptions, Button, Spin, Alert, Card, message, Popconfirm, Space } from 'antd';
import { useTicketStore } from '../store/ticketStore';
import { NEXT_STATUS, STATUS_LABELS } from '../types/ticket.types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface Props {
  id: string;
  onBack: () => void;
}

export default function TicketDetail({ id, onBack }: Props) {
  const { selectedTicket, loading, error, fetchTicket, updateStatus, deleteTicket, clearError } = useTicketStore();

  useEffect(() => { fetchTicket(id); }, [id]);

  if (loading && !selectedTicket) return <Spin size="large" />;

  if (error && !selectedTicket) {
    return <Alert message={error} type="error" action={<Button onClick={onBack}>Back</Button>} />;
  }

  const ticket = selectedTicket;
  if (!ticket) return null;

  const nextStatus = NEXT_STATUS[ticket.status];

  const handleMove = async () => {
    if (!nextStatus) return;
    await updateStatus(ticket.id, nextStatus);
    message.success(`Ticket moved to ${STATUS_LABELS[nextStatus]}`);
  };

  const handleDelete = async () => {
    await deleteTicket(ticket.id);
    message.success('Ticket deleted');
    onBack();
  };

  return (
    <Card
      title={ticket.title}
      extra={
        <Space>
          <Popconfirm
            title="Delete this ticket?"
            description="This action cannot be undone."
            onConfirm={handleDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger loading={loading}>Delete</Button>
          </Popconfirm>
          <Button onClick={onBack}>Back to List</Button>
        </Space>
      }
    >
      {error && <Alert message={error} type="error" closable onClose={clearError} style={{ marginBottom: 16 }} />}
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Status"><StatusBadge status={ticket.status} /></Descriptions.Item>
        <Descriptions.Item label="Priority"><PriorityBadge priority={ticket.priority} /></Descriptions.Item>
        <Descriptions.Item label="Customer">{ticket.customerName}</Descriptions.Item>
        <Descriptions.Item label="Email">{ticket.customerEmail}</Descriptions.Item>
        <Descriptions.Item label="Description">{ticket.description}</Descriptions.Item>
        <Descriptions.Item label="Created">{new Date(ticket.createdAt).toLocaleString()}</Descriptions.Item>
        {ticket.resolvedAt && (
          <Descriptions.Item label="Resolved">{new Date(ticket.resolvedAt).toLocaleString()}</Descriptions.Item>
        )}
        {ticket.modifiedBy && (
          <Descriptions.Item label="Last Modified By">{ticket.modifiedBy}</Descriptions.Item>
        )}
      </Descriptions>
      {nextStatus && (
        <Button type="primary" style={{ marginTop: 16 }} loading={loading} onClick={handleMove}>
          Move to {STATUS_LABELS[nextStatus]}
        </Button>
      )}
    </Card>
  );
}
