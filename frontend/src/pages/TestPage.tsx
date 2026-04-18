import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Question } from '../types';
import './TestPage.css';

export function TestPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/test/questions', token)
      .then(data => setQuestions(data.questions))
      .catch(err => {
        if (err?.message?.includes('retake_locked') || err?.status === 403) {
          setError('retake_locked');
        } else {
          setError('Ошибка загрузки вопросов');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const q = questions[current];
  const answered = answers[q?.id];
  const progress = Object.keys(answers).length;
  const total = questions.length;
  const pct = total ? (progress / total) * 100 : 0;

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [q.id]: value }));
    // Auto-advance
    if (current < questions.length - 1) {
      setTimeout(() => setCurrent(c => c + 1), 250);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < 25) {
      setError('Пожалуйста, ответьте на все вопросы перед отправкой.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }));
      await api.post('/test/submit', { answers: payload }, token);
      navigate('/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

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
      {/* Progress bar */}
      <div className="test-progress-bar">
        <div className="test-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="test-container container">
        {/* Header */}
        <div className="test-header animate-fadeIn">
          <span className="test-counter">{current + 1} / {total}</span>
          <span className="test-answered">{progress} отвечено</span>
        </div>

        {/* Question */}
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

        {/* Navigation */}
        <div className="test-nav">
          <button
            className="btn btn-ghost"
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            ← Назад
          </button>

          {current < questions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrent(c => c + 1)}
            >
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

        {/* Question dots */}
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
