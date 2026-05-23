// Unit-тесты для AuthContext
// Проверяет: login, logout, isAdmin, инициализацию через /auth/me

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '../api/client';

const mockUser = { id: 'u1', email: 'test@example.com', name: 'Иван', has_paid: false };

function TestConsumer() {
  const { user, loading, isAdmin, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <button onClick={() => login(mockUser)}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('изначально loading=true, потом false если /auth/me возвращает ошибку', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('при успешном /auth/me — устанавливает пользователя', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    });
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('при ошибке /auth/me — пользователь остаётся null', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login устанавливает пользователя', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
  });

  it('logout вызывает /auth/logout и очищает пользователя', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('test@example.com'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(api.post).toHaveBeenCalledWith('/auth/logout', {});
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('isAdmin=false для обычного пользователя', async () => {
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
