import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 60px)',
      textAlign: 'center', padding: '40px 24px', gap: '16px',
    }}>
      <div style={{ fontSize: '96px', lineHeight: 1, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--accent)' }}>
        404
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: 0 }}>
        Страница не найдена
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '360px', margin: 0 }}>
        Такой страницы не существует или она была удалена.
      </p>
      <Link
        to={user ? '/dashboard' : '/'}
        className="btn btn-primary"
        style={{ marginTop: '12px', padding: '12px 28px' }}
      >
        {user ? 'На главную' : 'На лендинг'}
      </Link>
    </div>
  );
}
