import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import './PaymentPage.css';

interface YooKassaWidget {
  render: (containerId: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YooMoneyCheckoutWidget: any;
  }
}

export function PaymentPage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationToken, setConfirmationToken] = useState('');
  const widgetRef = useRef<YooKassaWidget | null>(null);

  useEffect(() => {
    if (!confirmationToken) return;

    const scriptId = 'yookassa-widget-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      widgetRef.current?.destroy();
    };
  }, [confirmationToken]);

  function initWidget() {
    if (!confirmationToken || !window.YooMoneyCheckoutWidget) return;
    widgetRef.current?.destroy();
    const checkout = new window.YooMoneyCheckoutWidget({
      confirmation_token: confirmationToken,
      return_url: `${window.location.origin}/payment/success`,
      error_callback: (err: unknown) => {
        console.error('YooKassa widget error:', err);
        setError('Ошибка платёжного виджета. Попробуйте ещё раз.');
        setConfirmationToken('');
      },
    });
    checkout.render('yookassa-widget');
    widgetRef.current = checkout;
  }

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
      sessionStorage.setItem('payment_label', data.label);
      setConfirmationToken(data.confirmationToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
    } finally {
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

        {/* Right: payment */}
        <div className="payment-card card">
          {confirmationToken ? (
            <div id="yookassa-widget" />
          ) : (
            <>
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
                  Оплата через защищённый виджет ЮKassa прямо на этой странице.
                </p>
              </div>

              {error && <div className="payment-error">{error}</div>}

              <button
                className="btn btn-primary payment-btn"
                onClick={handlePay}
                disabled={loading}
              >
                {loading ? 'Загружаем форму оплаты...' : 'Оплатить 299 ₽ →'}
              </button>

              <p className="payment-secure">
                🔒 Безопасная обработка — ЮKassa
              </p>
            </>
          )}
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
            <h2 className="success-title">Проверяем оплату</h2>
            <p className="success-desc">
              Если вы завершили оплату, нажмите кнопку ниже. Иногда требуется несколько секунд.
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
