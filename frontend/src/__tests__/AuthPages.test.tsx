// Компонентные тесты для LoginPage и RegisterPage
// Проверяет: отрисовку формы, ввод данных, успешный сабмит, отображение ошибок

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/AuthPages';
import { RegisterPage } from '../pages/AuthPages';

// ─── моки ────────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../api/client';

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

function renderRegister() {
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>);
}

// ─── LoginPage ───────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отображает поля email и пароль и кнопку входа', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  it('успешный вход вызывает login и переходит на /dashboard', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'jwt',
      user: { id: '1', email: 'user@example.com', has_paid: false },
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jwt', expect.objectContaining({ email: 'user@example.com' }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('показывает сообщение об ошибке при неверных данных', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Неверный email или пароль'));

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'bad@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByText('Неверный email или пароль')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('кнопка показывает "Входим..." во время запроса', async () => {
    let resolve!: (v: unknown) => void;
    (api.post as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(r => { resolve = r; }));

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'u@e.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    expect(screen.getByRole('button', { name: /входим/i })).toBeDisabled();

    resolve({ token: 'jwt', user: { id: '1', email: 'u@e.com', has_paid: false } });
  });

  it('содержит ссылку на страницу регистрации', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /зарегистрироваться/i })).toBeInTheDocument();
  });
});

// ─── RegisterPage ────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отображает поля имя, email, пароль', () => {
    renderRegister();
    expect(screen.getByPlaceholderText('Андрей')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Минимум 6 символов')).toBeInTheDocument();
  });

  it('успешная регистрация вызывает login и переходит на /dashboard', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'jwt',
      user: { id: '2', email: 'new@example.com', has_paid: false },
    });

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Андрей'), 'Андрей');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Минимум 6 символов'), 'password123');
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jwt', expect.objectContaining({ email: 'new@example.com' }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('показывает ошибку если email уже занят', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Пользователь с таким email уже существует'));

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'taken@example.com');
    await user.type(screen.getByPlaceholderText('Минимум 6 символов'), 'pass123');
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(screen.getByText('Пользователь с таким email уже существует')).toBeInTheDocument();
    });
  });

  it('содержит ссылку на страницу входа', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /войти/i })).toBeInTheDocument();
  });
});
