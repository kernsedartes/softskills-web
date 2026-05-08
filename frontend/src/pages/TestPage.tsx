import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Question } from '../types';
import './TestPage.css';

type Variant = 'express' | 'standard' | 'extended';

const VARIANTS: { id: Variant; label: string; description: string; count: number; time: string; icon: string }[] = [
  {
    id: 'express',
    label: 'Экспресс',
    description: 'Быстрая диагностика — 3 вопроса на каждый навык. Подходит для первого знакомства или повторной проверки.',
    count: 15,
    time: '~5 минут',
    icon: '⚡',
  },
  {
    id: 'standard',
    label: 'Стандартный',
    description: 'Полная диагностика — 5 вопросов на каждый навык. Даёт точный и детальный результат.',
    count: 25,
    time: '~10 минут',
    icon: '📊',
  },
  {
    id: 'extended',
    label: 'Расширенный',
    description: 'Углублённая диагностика — 10 вопросов на каждый навык. Максимальная точность профиля компетенций.',
    count: 50,
    time: '~20 минут',
    icon: '🔬',
  },
];

export function TestPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [variant, setVariant] = useState<Variant | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!variant) return;
    setLoading(true);
    setError('');
    api.get(`/test/questions?variant=${variant}`, token)
      .then(data => setQuestions(data.questions))
      .catch(err => {
        if (err?.message?.includes('retake_locked') || err?.status === 403) {
          setError('retake_locked');
        } else {
          setError('Ошибка загрузки вопросов');
        }
      })
      .finally(() => setLoading(false));
  }, [variant, token]);

  const q = questions[current];
  const answered = answers[q?.id];
  const progress = Object.keys(answers).length;
  const total = questions.length;
  const pct = total ? (progress / total) * 100 : 0;

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [q.id]: value }));
    if (current < questions.length - 1) {
      setTimeout(() => setCurrent(c => c + 1), 250);
    }
  };

  const handleSubmit = async () => {
    if (progress < total) {
      setError('Пожалуйста, ответьте на все вопросы перед отправкой.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }));
      await api.post('/test/submit', { answers: payload, variant }, token);
      navigate('/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

  // Variant selection screen
  if (!variant) {
    return (
      <div className="test-variant-page container">
        <div className="test-variant-header animate-fadeUp">
          <h1 className="test-variant-title">Выберите формат теста</h1>
          <p className="test-variant-sub">
            Оба варианта используют одинаковую шкалу результатов — можно сравнивать попытки
          </p>
        </div>
        <div className="test-variant-cards animate-fadeUp">
          {VARIANTS.map(v => (
            <button
              key={v.id}
              className="test-variant-card card"
              onClick={() => setVariant(v.id)}
            >
              <div className="test-variant-icon">{v.icon}</div>
              <div className="test-variant-name">{v.label}</div>
              <div className="test-variant-meta">
                <span className="test-variant-count">{v.count} вопросов</span>
                <span className="test-variant-time">{v.time}</span>
              </div>
              <p className="test-variant-desc">{v.description}</p>
              <span className="btn btn-primary test-variant-btn">Начать →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="test-loading">Загружаем вопросы...</div>;

  if (error === 'retake_locked') return (
    <div className="test-locked container">
      <div className="test-locked-card card animate-fadeUp">
        <div className="test-locked-icon">🔒</div>
        <h2>Тест уже пройден</h2>
        <p>Бесплатный доступ позволяет пройти тест один раз. Откройте расширенный доступ, чтобы проходить тест повторно и отслеживать динамику.</p>
        <div className="test-locked-actions">
          <a href="/payment" className="btn btn-primary">Открыть доступ за 299 ₽</a>
          <a href="/results" className="btn btn-ghost">Посмотреть результаты</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="test-page">
      <div className="test-progress-bar">
        <div className="test-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="test-container container">
        <div className="test-header animate-fadeIn">
          <span className="test-counter">{current + 1} / {total}</span>
          <span className="test-answered">{progress} отвечено</span>
        </div>

        {q && (
          <div className="test-card card animate-fadeUp" key={q.id}>
            <p className="test-question">{q.text}</p>
            <div className="test-options">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  className={`test-option ${answered === i + 1 ? 'selected' : ''}`}
                  onClick={() => handleAnswer(i + 1)}
                >
                  <span className="test-option-dot" />
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="test-nav">
          <button
            className="btn btn-ghost"
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            ← Назад
          </button>

          {current < questions.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setCurrent(c => c + 1)}>
              Далее →
            </button>
          ) : (
            <button
              className="btn btn-green"
              onClick={handleSubmit}
              disabled={submitting || progress < total}
            >
              {submitting ? 'Отправляем...' : `Завершить тест (${progress}/${total})`}
            </button>
          )}
        </div>

        <div className="test-dots">
          {questions.map((q_, i) => (
            <button
              key={q_.id}
              className={`test-dot ${answers[q_.id] ? 'done' : ''} ${i === current ? 'active' : ''}`}
              onClick={() => setCurrent(i)}
              title={`Вопрос ${i + 1}`}
            />
          ))}
        </div>

        {error && <div className="test-error">{error}</div>}
      </div>
    </div>
  );
}
