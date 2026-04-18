import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import './ProfilePage.css';

interface Stats {
  exercisesTotal: number;
  exercisesCompleted: number;
  exercisesInProgress: number;
  testTaken: boolean;
  testDate: string | null;
  programDate: string | null;
}

export function ProfilePage() {
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailError, setEmailError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);

  useEffect(() => {
    api.get('/auth/stats', token).then(setStats).catch(() => {});
  }, [token]);

  const handleSaveName = async () => {
    setNameLoading(true);
    setNameMsg('');
    try {
      await api.patch('/auth/profile', { name }, token);
      await refreshUser();
      setNameMsg('ok');
      toast('Имя успешно сохранено', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setNameMsg(msg);
      toast(msg, 'error');
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    setEmailError('');
    setEmailMsg('');
    setEmailLoading(true);
    try {
      await api.patch('/auth/email', { newEmail, password: emailPassword }, token);
      await refreshUser();
      setEmailMsg('ok');
      setNewEmail('');
      setEmailPassword('');
      toast('Email успешно изменён', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setEmailError(msg);
      toast(msg, 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdMsg('');
    if (newPassword !== confirmPassword) { setPwdError('Пароли не совпадают'); return; }
    setPwdLoading(true);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword }, token);
      setPwdMsg('ok');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Пароль успешно изменён', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setPwdError(msg);
      toast(msg, 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarLoading(true);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvatarPreview(data.avatarUrl);
      await refreshUser();
    } catch {
      setAvatarPreview(user?.avatar ?? null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarLoading(true);
    try {
      await api.delete('/auth/avatar', token);
      setAvatarPreview(null);
      await refreshUser();
    } finally {
      setAvatarLoading(false);
    }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const initials = user?.name ? user.name[0].toUpperCase() : user?.email[0].toUpperCase();

  return (
    <div className="profile-page container">

      {/* Stats */}
      <div className="profile-stats animate-fadeUp">
        <div className="profile-stat">
          <div className="profile-stat-value">{stats?.exercisesCompleted ?? '—'}</div>
          <div className="profile-stat-label">Выполнено упражнений</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats?.exercisesInProgress ?? '—'}</div>
          <div className="profile-stat-label">В процессе</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats?.exercisesTotal ?? '—'}</div>
          <div className="profile-stat-label">Всего в программе</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats?.testTaken ? '✓' : '—'}</div>
          <div className="profile-stat-label">Тест пройден</div>
        </div>
      </div>

      <div className="profile-grid">

        {/* Avatar + account info */}
        <div className="profile-card card animate-fadeUp">
          <h2 className="profile-section-title">Профиль</h2>

          <div className="profile-avatar-block">
            <div className="profile-avatar-wrap">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="profile-avatar-img" />
                : <div className="profile-avatar-placeholder">{initials}</div>
              }
              {avatarLoading && <div className="profile-avatar-overlay">...</div>}
            </div>
            <div className="profile-avatar-actions">
              <button className="btn btn-ghost profile-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}>
                {avatarPreview ? 'Сменить фото' : 'Загрузить фото'}
              </button>
              {avatarPreview && (
                <button className="btn btn-ghost profile-btn-sm profile-btn-danger" onClick={handleRemoveAvatar} disabled={avatarLoading}>
                  Удалить
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span className="profile-avatar-hint">JPG, PNG, WEBP · до 2 МБ</span>
            </div>
          </div>

          <div className="profile-divider" />

          <div className="profile-info-row">
            <span className="profile-info-label">Email</span>
            <span className="profile-info-value">{user?.email}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-info-label">Дата регистрации</span>
            <span className="profile-info-value">{fmt(user?.created_at ?? null)}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-info-label">Тест пройден</span>
            <span className="profile-info-value">{fmt(stats?.testDate ?? null)}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-info-label">Программа создана</span>
            <span className="profile-info-value">{fmt(stats?.programDate ?? null)}</span>
          </div>
          <div className="profile-info-row" style={{ borderBottom: 'none' }}>
            <span className="profile-info-label">Доступ</span>
            <span className={`profile-badge ${user?.has_paid ? 'badge-paid' : 'badge-free'}`}>
              {user?.has_paid ? 'Расширенный' : 'Базовый'}
            </span>
          </div>
        </div>

        <div className="profile-col">

          {/* Edit name */}
          <div className="profile-card card animate-fadeUp">
            <h2 className="profile-section-title">Имя</h2>
            <div className="profile-field">
              <label>Отображаемое имя</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Введите имя" />
            </div>
            {nameMsg === 'ok' && <div className="profile-msg msg-ok">Сохранено</div>}
            {nameMsg && nameMsg !== 'ok' && <div className="profile-msg msg-err">{nameMsg}</div>}
            <button className="btn btn-primary profile-btn" onClick={handleSaveName} disabled={nameLoading}>
              {nameLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          {/* Change email */}
          <div className="profile-card card animate-fadeUp">
            <h2 className="profile-section-title">Смена email</h2>
            <div className="profile-field">
              <label>Новый email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" />
            </div>
            <div className="profile-field">
              <label>Текущий пароль для подтверждения</label>
              <input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="••••••" />
            </div>
            {emailError && <div className="profile-msg msg-err">{emailError}</div>}
            {emailMsg === 'ok' && <div className="profile-msg msg-ok">Email изменён</div>}
            <button className="btn btn-primary profile-btn" onClick={handleChangeEmail} disabled={emailLoading || !newEmail || !emailPassword}>
              {emailLoading ? 'Сохранение...' : 'Сменить email'}
            </button>
          </div>

          {/* Change password */}
          <div className="profile-card card animate-fadeUp">
            <h2 className="profile-section-title">Смена пароля</h2>
            <div className="profile-field">
              <label>Текущий пароль</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••" />
            </div>
            <div className="profile-field">
              <label>Новый пароль</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Минимум 6 символов" />
            </div>
            <div className="profile-field">
              <label>Повторите новый пароль</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••" />
            </div>
            {pwdError && <div className="profile-msg msg-err">{pwdError}</div>}
            {pwdMsg === 'ok' && <div className="profile-msg msg-ok">Пароль изменён</div>}
            <button className="btn btn-primary profile-btn" onClick={handleChangePassword} disabled={pwdLoading || !currentPassword || !newPassword || !confirmPassword}>
              {pwdLoading ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
