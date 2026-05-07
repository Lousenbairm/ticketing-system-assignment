import { useState, useEffect } from 'react';
import { Layout, Typography, Button } from 'antd';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import PublicSubmit from './components/PublicSubmit';
import AdminLogin from './components/AdminLogin';

type View =
  | { type: 'public' }
  | { type: 'admin-login' }
  | { type: 'list' }
  | { type: 'detail'; id: string };

const { Header, Content } = Layout;

export default function App() {
  const [view, setView] = useState<View>(
    localStorage.getItem('token') ? { type: 'list' } : { type: 'public' }
  );

  useEffect(() => {
    const handler = () => setView({ type: 'admin-login' });
    window.addEventListener('unauthorized', handler);
    return () => window.removeEventListener('unauthorized', handler);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setView({ type: 'public' });
  };

  if (view.type === 'public') {
    return <PublicSubmit onAdminLogin={() => setView({ type: 'admin-login' })} />;
  }

  if (view.type === 'admin-login') {
    return (
      <AdminLogin
        onSuccess={() => setView({ type: 'list' })}
        onBack={() => setView({ type: 'public' })}
      />
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>Support Tickets</Typography.Title>
        <Button onClick={logout}>Logout</Button>
      </Header>
      <Content style={{ maxWidth: 1100, margin: '24px auto', width: '100%', padding: '0 16px' }}>
        {view.type === 'list' && (
          <TicketList onSelect={id => setView({ type: 'detail', id })} />
        )}
        {view.type === 'detail' && (
          <TicketDetail id={view.id} onBack={() => setView({ type: 'list' })} />
        )}
      </Content>
    </Layout>
  );
}
