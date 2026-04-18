import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import './PaymentPage.css';

export function PaymentPage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user?.has_paid) {
    return (
      <div className="payment-page container">
        <div className="payment-already card animate-fadeUp">
          <div className="payment-already-icon">✅</div>
          <h2>У вас уже есть расширенный доступ</h2>
          <p>Все упражнения программы доступны.</p>
          <Link to="/program" className="btn btn-primary">Перейти к программе</Link>
        </div>
      </div>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/payment/create', {}, token);
      // Store label to check on return
      sessionStorage.setItem('payment_label', data.label);
      // Redirect to ЮMoney
      window.location.href = data.paymentUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
      setLoading(false);
    }
  };

  return (
    <div className="payment-page container">
      <div className="payment-wrapper animate-fadeUp">
        {/* Left: info */}
        <div className="payment-info">
          <div className="payment-badge">Расширенный доступ</div>
          <h1 className="payment-title">Откройте полный потенциал</h1>
          <p className="payment-desc">
            Единовременная оплата. Никаких подписок. Доступ навсегда.
          </p>

          <ul className="payment-features">
            {[
              'Все упражнения персональной программы',
              'Расширенная аналитика по навыкам',
              'Детальные рекомендации к каждому упражнению',
              'Повторные тесты с сохранением динамики',
              'Поддержка и обновления программы',
            ].map((f, i) => (
              <li key={i} className="payment-feature">
                <span className="payment-feature-check">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <div className="payment-compare">
            <div className="compare-item">
              <div className="compare-service">4Skills</div>
              <div className="compare-price">от 3 000 ₽/сессия</div>
            </div>
            <div className="compare-item">
              <div className="compare-service">Skillary</div>
              <div className="compare-price">590 ₽/мес</div>
            </div>
            <div className="compare-item compare-item-us">
              <div className="compare-service">SoftSkills</div>
              <div className="compare-price">299 ₽ разово</div>
            </div>
          </div>
        </div>

        {/* Right: payment card */}
        <div className="payment-card card">
          <div className="payment-price-block">
            <div className="payment-price">299 ₽</div>
            <div className="payment-price-note">единовременно, навсегда</div>
          </div>

          <div className="payment-divider" />

          <div className="payment-method">
            <div className="payment-method-label">Способ оплаты</div>
            <div className="payment-method-option selected">
              <span>💳 Банковская карта</span>
              <span className="payment-method-check">✓</span>
            </div>
            <p className="payment-method-note">
              После нажатия вы будете перенаправлены на защищённую страницу оплаты.
              По возвращении доступ откроется автоматически.
            </p>
          </div>

          {error && <div className="payment-error">{error}</div>}

          <button
            className="btn btn-primary payment-btn"
            onClick={handlePay}
            disabled={loading}
          >
            {loading ? 'Переходим к оплате...' : 'Оплатить 299 ₽ →'}
          </button>

          <p className="payment-secure">
            🔒 Безопасная обработка платежа
          </p>
        </div>
      </div>
    </div>
  );
}

export function PaymentSuccessPage() {
  const { token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'paid' | 'pending'>('idle');

  useEffect(() => {
    const label = sessionStorage.getItem('payment_label');
    if (label) checkPayment(label);
  }, []);

  const checkPayment = async (labelOverride?: string) => {
    const label = labelOverride ?? sessionStorage.getItem('payment_label');
    if (!label) { navigate('/payment'); return; }
    setChecking(true);
    try {
      const data = await api.get(`/payment/status/${label}`, token);
      if (data.payment.status === 'PAID') {
        await refreshUser();
        sessionStorage.removeItem('payment_label');
        setStatus('paid');
        setTimeout(() => navigate('/program'), 2500);
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('pending');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="success-page container">
      <div className="success-card card animate-fadeUp">
        {status === 'paid' ? (
          <>
            <div className="success-icon">🎉</div>
            <h2 className="success-title">Оплата прошла!</h2>
            <p className="success-desc">Расширенный доступ активирован. Перенаправляем на программу...</p>
          </>
        ) : (
          <>
            <div className="success-icon">⏳</div>
            <h2 className="success-title">Проверьте оплату</h2>
            <p className="success-desc">
              Если вы завершили оплату на ЮMoney, нажмите кнопку ниже.
              Иногда требуется несколько секунд для подтверждения.
            </p>

            {status === 'pending' && (
              <div className="success-pending">
                Оплата ещё не подтверждена. Подождите немного и попробуйте снова.
              </div>
            )}

            <div className="success-actions">
              <button
                className="btn btn-primary"
                onClick={() => checkPayment()}
                disabled={checking}
              >
                {checking ? 'Проверяем...' : 'Проверить статус оплаты'}
              </button>
              <Link to="/payment" className="btn btn-ghost">Назад к оплате</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
