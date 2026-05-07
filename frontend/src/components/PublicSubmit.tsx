import { useState } from 'react';
import { Layout, Typography, Button, Alert, Form, Input, Select } from 'antd';
import { ticketsApi } from '../api/tickets';
import type { CreateTicketPayload } from '../types/ticket.types';

const { Header, Content } = Layout;

interface Props {
  onAdminLogin: () => void;
}

export default function PublicSubmit({ onAdminLogin }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: CreateTicketPayload) => {
    setLoading(true);
    setError(null);
    try {
      await ticketsApi.create(values);
      form.resetFields();
      setSubmitted(true);
    } catch {
      setError('Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>Support Tickets</Typography.Title>
        <Button onClick={onAdminLogin}>Admin Login</Button>
      </Header>
      <Content style={{ maxWidth: 600, margin: '24px auto', width: '100%', padding: '0 16px' }}>
        <Typography.Title level={3}>Submit a Ticket</Typography.Title>
        {submitted && (
          <Alert
            message="Ticket submitted successfully!"
            description="Our team will get back to you soon."
            type="success"
            showIcon
            closable
            onClose={() => setSubmitted(false)}
            style={{ marginBottom: 24 }}
          />
        )}
        {error && (
          <Alert message={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
        )}
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="customerName" label="Your Name" rules={[{ required: true }]}>
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
            <Button type="primary" htmlType="submit" loading={loading}>Submit Ticket</Button>
          </Form.Item>
        </Form>
      </Content>
    </Layout>
  );
}
