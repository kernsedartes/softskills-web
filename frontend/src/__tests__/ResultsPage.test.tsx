// Компонентные тесты для ResultsPage
// Проверяет: состояние загрузки, пустое состояние, отображение результатов

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultsPage } from '../pages/ResultsPage';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com', name: 'Иван', has_paid: false },
  }),
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));

// recharts требует ResizeObserver в jsdom
(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { api } from '../api/client';

const mockScores = [
  { id: 's1', skill: 'communication', score: 80 },
  { id: 's2', skill: 'leadership', score: 30 },
  { id: 's3', skill: 'self_organization', score: 50 },
  { id: 's4', skill: 'empathy', score: 70 },
  { id: 's5', skill: 'critical_thinking', score: 20 },
];

function renderPage() {
  return render(<MemoryRouter><ResultsPage /></MemoryRouter>);
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('показывает индикатор загрузки пока данные не получены', () => {
    (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/загружаем результаты/i)).toBeInTheDocument();
  });

  it('показывает "Тест не пройден" если API вернул ошибку', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('404'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/тест не пройден/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /начать тест/i })).toBeInTheDocument();
  });

  it('отображает заголовок и имя пользователя после загрузки', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ scores: mockScores })
      .mockResolvedValueOnce({ history: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/ваши результаты/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/иван/i)).toBeInTheDocument();
  });

  it('показывает зоны роста (3 слабейших навыка)', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ scores: mockScores })
      .mockResolvedValueOnce({ history: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/зоны роста/i)).toBeInTheDocument();
    });

    // слабейшие: critical_thinking(20), leadership(30), self_organization(50)
    const weakCard = screen.getByText(/зоны роста/i).closest('.summary-card') as HTMLElement;
    expect(within(weakCard).getByText(/Критическое мышление/)).toBeInTheDocument();
    expect(within(weakCard).getByText(/Лидерство/)).toBeInTheDocument();
  });

  it('показывает кнопку "Открыть программу развития"', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ scores: mockScores })
      .mockResolvedValueOnce({ history: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /открыть программу развития/i })).toBeInTheDocument();
    });
  });

  it('для бесплатного пользователя показывает ссылку на оплату', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ scores: mockScores })
      .mockResolvedValueOnce({ history: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /расширенный доступ/i })).toBeInTheDocument();
    });
  });

  it('показывает подсказку о динамике если история только одна попытка', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ scores: mockScores })
      .mockResolvedValueOnce({ history: mockScores.map(s => ({ ...s, attempt: 1 })) });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/динамика навыков/i)).toBeInTheDocument();
    });
  });
});
