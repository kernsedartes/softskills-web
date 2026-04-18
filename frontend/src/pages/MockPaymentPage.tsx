import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import './MockPaymentPage.css';

export function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const label = searchParams.get('label') || '';
  const { token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const formatCard = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/payment/mock-confirm', { label }, token);
      await refreshUser();
      sessionStorage.setItem('payment_label', label);
      navigate('/payment/success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка оплаты');
      setLoading(false);
    }
  };

  return (
    <div className="mock-payment-page container">
      <div className="mock-payment-card card animate-fadeUp">
        <div className="mock-header">
          <div className="mock-logo">💳 Тестовый платёж</div>
          <div className="mock-badge">Демо-режим</div>
        </div>

        <div className="mock-merchant">
          <div className="mock-merchant-name">SoftSkills</div>
          <div className="mock-merchant-desc">Расширенный доступ</div>
        </div>

        <div className="mock-amount">299 ₽</div>

        <div className="mock-form">
          <div className="mock-field">
            <label>Номер карты</label>
            <input
              type="text"
              placeholder="0000 0000 0000 0000"
              value={card}
              onChange={e => setCard(formatCard(e.target.value))}
              maxLength={19}
            />
          </div>
          <div className="mock-field-row">
            <div className="mock-field">
              <label>Срок действия</label>
              <input
                type="text"
                placeholder="ММ/ГГ"
                value={expiry}
                onChange={e => setExpiry(formatExpiry(e.target.value))}
                maxLength={5}
              />
            </div>
            <div className="mock-field">
              <label>CVV</label>
              <input
                type="password"
                placeholder="•••"
                value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>
        </div>

        <div className="mock-label">
          Код платежа: <strong>{label}</strong>
        </div>

        {error && <div className="mock-error">{error}</div>}

        <button
          className="btn btn-primary mock-btn"
          onClick={handlePay}
          disabled={loading}
        >
          {loading ? 'Обработка...' : 'Оплатить 299 ₽'}
        </button>

        <button
          className="btn btn-ghost mock-cancel"
          onClick={() => navigate('/payment')}
          disabled={loading}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
