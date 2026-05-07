import { Form, Input, Select, Button, Alert } from 'antd';
import { useTicketStore } from '../store/ticketStore';
import type { CreateTicketPayload } from '../types/ticket.types';

interface Props {
  onSuccess: () => void;
}

export default function TicketForm({ onSuccess }: Props) {
  const [form] = Form.useForm();
  const { loading, error, createTicket, clearError } = useTicketStore();

  const onFinish = async (values: CreateTicketPayload) => {
    try {
      await createTicket(values);
      form.resetFields();
      onSuccess();
    } catch {
      // error shown via Alert
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
      {error && <Alert message={error} type="error" closable onClose={clearError} style={{ marginBottom: 16 }} />}
      <Form.Item name="customerName" label="Customer Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="customerEmail" label="Email" rules={[{ required: true }, { type: 'email' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="title" label="Subject" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: true }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
        <Select options={[{ value: 'LOW' }, { value: 'MEDIUM' }, { value: 'HIGH' }]} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>Submit</Button>
      </Form.Item>
    </Form>
  );
}
