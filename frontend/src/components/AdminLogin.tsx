import { useState } from 'react';
import { Form, Input, Button, Alert, Card, Typography } from 'antd';
import { authApi } from '../api/auth';

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

export default function AdminLogin({ onSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { access_token } = await authApi.login(username, password);
      localStorage.setItem('token', access_token);
      onSuccess();
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4} style={{ marginBottom: 24 }}>Admin Login</Typography.Title>
        {error && <Alert message={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Login</Button>
          </Form.Item>
          <Button type="link" onClick={onBack} style={{ padding: 0 }}>← Back to ticket form</Button>
        </Form>
      </Card>
    </div>
  );
}
