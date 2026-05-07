import { useEffect } from 'react';
import { Table, Tabs, Input, Alert, Button, Switch, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTicketStore } from '../store/ticketStore';
import type { Ticket, TicketStatus } from '../types/ticket.types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

const STATUS_TABS: { key: TicketStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

interface Props {
  onSelect: (id: string) => void;
}

export default function TicketList({ onSelect }: Props) {
  const { tickets, loading, error, fetchTickets, setFilter, setSearch, setIncludeDeleted, includeDeleted, clearError } = useTicketStore();

  useEffect(() => { fetchTickets(); }, []);

  const PRIORITY_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

  const columns: ColumnsType<Ticket> = [
    { title: 'Title', dataIndex: 'title', key: 'title', sorter: (a, b) => a.title.localeCompare(b.title) },
    { title: 'Customer Name', dataIndex: 'customerName', key: 'customerName', sorter: (a, b) => a.customerName.localeCompare(b.customerName) },
    { title: 'Email', dataIndex: 'customerEmail', key: 'customerEmail' },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: p => <PriorityBadge priority={p} />, sorter: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => <StatusBadge status={s} />, sorter: (a, b) => a.status.localeCompare(b.status) },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: d => new Date(d).toLocaleDateString(), sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
    {
      title: 'Action', key: 'action',
      render: (_, record) => <Button size="small" onClick={() => onSelect(record.id)}>View</Button>,
    },
  ];

  return (
    <>
      {error && <Alert message={error} type="error" closable onClose={clearError} style={{ marginBottom: 16 }} />}
      <Tabs
        defaultActiveKey="ALL"
        items={STATUS_TABS.map(t => ({ key: t.key, label: t.label }))}
        onChange={key => setFilter(key === 'ALL' ? undefined : key as TicketStatus)}
      />
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="Search by title, customer name or email"
          onSearch={setSearch}
          allowClear
          style={{ width: 360 }}
        />
        <Space>
          <span>Show deleted</span>
          <Switch checked={includeDeleted} onChange={setIncludeDeleted} />
        </Space>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={tickets}
        loading={loading}
        onRow={r => ({
          style: r.deletedAt
            ? { opacity: 0.45, textDecoration: 'line-through', background: '#f5f5f5' }
            : {},
        })}
      />
    </>
  );
}
