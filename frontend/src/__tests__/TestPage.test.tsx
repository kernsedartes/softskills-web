// Компонентные тесты для TestPage
// Проверяет: выбор варианта, навигацию по вопросам, блокировку повторного прохождения

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TestPage } from '../pages/TestPage';

const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({}),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '../api/client';

const mockQuestions = Array.from({ length: 15 }, (_, i) => ({
  id: `q-${i}`,
  text: `Вопрос ${i + 1}`,
  skill: ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'][Math.floor(i / 3)],
  options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'],
  order: i,
}));

function renderPage() {
  return render(<MemoryRouter><TestPage /></MemoryRouter>);
}

describe('TestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Экран выбора варианта ──────────────────────────────────────────────────

  describe('Выбор варианта теста', () => {
    it('отображает три варианта теста', () => {
      renderPage();

      expect(screen.getByText('Экспресс')).toBeInTheDocument();
      expect(screen.getByText('Стандартный')).toBeInTheDocument();
      expect(screen.getByText('Расширенный')).toBeInTheDocument();
    });

    it('показывает количество вопросов и время для каждого варианта', () => {
      renderPage();

      expect(screen.getByText('15 вопросов')).toBeInTheDocument();
      expect(screen.getByText('25 вопросов')).toBeInTheDocument();
      expect(screen.getByText('50 вопросов')).toBeInTheDocument();
      expect(screen.getByText('~5 минут')).toBeInTheDocument();
    });

    it('при выборе варианта загружает вопросы', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        questions: mockQuestions,
        variant: 'express',
        questionsPerSkill: 3,
      });

      renderPage();
      const user = userEvent.setup();

      await user.click(screen.getAllByText('Начать →')[0]);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('variant=express')
        );
      });
    });
  });

  // ─── Прохождение теста ──────────────────────────────────────────────────────

  describe('Прохождение теста', () => {
    beforeEach(async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        questions: mockQuestions,
        variant: 'express',
        questionsPerSkill: 3,
      });
    });

    async function selectVariantAndWait() {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getAllByText('Начать →')[0]);
      await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeInTheDocument());
      return user;
    }

    it('показывает первый вопрос и счётчик 1 / 15', async () => {
      await selectVariantAndWait();
      expect(screen.getByText('Вопрос 1')).toBeInTheDocument();
      expect(screen.getByText('1 / 15')).toBeInTheDocument();
    });

    it('показывает 5 вариантов ответа', async () => {
      await selectVariantAndWait();
      expect(screen.getByText('Никогда')).toBeInTheDocument();
      expect(screen.getByText('Всегда')).toBeInTheDocument();
    });

    it('кнопка "Назад" недоступна на первом вопросе', async () => {
      await selectVariantAndWait();
      expect(screen.getByRole('button', { name: /← назад/i })).toBeDisabled();
    });

    it('при ответе на вопрос переходит к следующему', async () => {
      const user = await selectVariantAndWait();

      await user.click(screen.getByText('Всегда'));

      await waitFor(() => {
        expect(screen.getByText('Вопрос 2')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('кнопка завершения заблокирована пока не отвечены все вопросы', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        questions: mockQuestions.slice(0, 1),
        variant: 'express',
        questionsPerSkill: 3,
      });

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getAllByText('Начать →')[0]);
      await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeInTheDocument());

      const submitBtn = screen.getByRole('button', { name: /завершить тест/i });
      expect(submitBtn).toBeDisabled();
    });
  });

  // ─── Блокировка повторного прохождения ──────────────────────────────────────

  describe('retake_locked', () => {
    it('показывает экран блокировки если API вернул retake_locked', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('retake_locked'));

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getAllByText('Начать →')[0]);

      await waitFor(() => {
        expect(screen.getByText(/тест уже пройден/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('link', { name: /посмотреть результаты/i })).toBeInTheDocument();
    });
  });

  // ─── Отправка теста ─────────────────────────────────────────────────────────

  describe('Отправка результатов', () => {
    it('после успешной отправки переходит на /results', async () => {
      const singleQuestion = [mockQuestions[0]];
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        questions: singleQuestion,
        variant: 'express',
        questionsPerSkill: 3,
      });
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        scores: [],
        message: 'Тест успешно завершён',
      });

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getAllByText('Начать →')[0]);
      await waitFor(() => expect(screen.getByText('Вопрос 1')).toBeInTheDocument());

      await user.click(screen.getByText('Всегда'));

      await waitFor(() => {
        const submitBtn = screen.queryByRole('button', { name: /завершить тест/i });
        if (submitBtn && !submitBtn.hasAttribute('disabled')) {
          return;
        }
        throw new Error('not ready');
      }, { timeout: 1000 });

      const submitBtn = screen.getByRole('button', { name: /завершить тест/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/results');
      });
    });
  });
});
