// Unit-тесты для AuthContext
// Проверяет: login, logout, refreshUser, isAdmin, инициализацию из localStorage

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../api/client';

const mockUser = { id: 'u1', email: 'test@example.com', name: 'Иван', has_paid: false };

function TestConsumer() {
  const { user, token, loading, isAdmin, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <button onClick={() => login('jwt-token', mockUser)}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('изначально loading=true, потом false если нет сохранённого токена', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('при наличии токена в localStorage — запрашивает /auth/me и устанавливает пользователя', async () => {
    localStorage.setItem('token', 'saved-token');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    });
    expect(api.get).toHaveBeenCalledWith('/auth/me', 'saved-token');
  });

  it('при ошибке /auth/me — удаляет токен из localStorage', async () => {
    localStorage.setItem('token', 'bad-token');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login сохраняет токен в localStorage и устанавливает пользователя', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    expect(screen.getByTestId('token').textContent).toBe('jwt-token');
    expect(localStorage.getItem('token')).toBe('jwt-token');
  });

  it('logout очищает пользователя и токен из localStorage', async () => {
    localStorage.setItem('token', 'some-token');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('test@example.com'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('isAdmin=false для обычного пользователя', async () => {
    localStorage.setItem('token', 'tok');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
  });

  it('useAuth бросает ошибку вне AuthProvider', () => {
    function Naked() {
      useAuth();
      return null;
    }
    expect(() => render(<Naked />)).toThrow('useAuth must be inside AuthProvider');
  });
});
