import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { Resource, ResourceType, Skill, SkillScore, SKILL_LABELS, SKILL_ICONS, Question } from '../types';
import './AdminPage.css';

const TYPE_OPTIONS: ResourceType[] = ['book', 'article', 'video', 'course'];
const TYPE_LABEL: Record<ResourceType, string> = { book: 'Книга', article: 'Статья', video: 'Видео', course: 'Курс' };
const SKILL_OPTIONS: Skill[] = ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'];
const SKILL_COLORS: Record<Skill, string> = {
  communication: '#7c6aff', leadership: '#3ecf8e', self_organization: '#fbbf24',
  empathy: '#f87171', critical_thinking: '#60a5fa',
};

const EMPTY_RESOURCE = { title: '', author: '', description: '', type: 'book' as ResourceType, skill: 'communication' as Skill };
const EMPTY_QUESTION = { text: '', skill: 'communication' as Skill, options: ['', '', '', '', ''], order: 0 };

interface Stats {
  totalUsers: number;
  paidUsers: number;
  totalPayments: number;
  skillAverages: { skill: Skill; _avg: { score: number | null } }[];
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  has_paid: boolean;
  created_at: string;
}

type Tab = 'stats' | 'users' | 'questions' | 'resources';

const LEVEL_LABEL = (score: number) => {
  if (score >= 80) return { label: 'Отлично', color: '#3ecf8e' };
  if (score >= 60) return { label: 'Хорошо', color: '#7c6aff' };
  if (score >= 40) return { label: 'Средне', color: '#fbbf24' };
  return { label: 'Требует внимания', color: '#f87171' };
};

export function AdminPage() {
  const { isAdmin, token } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('stats');

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userScores, setUserScores] = useState<Record<string, SkillScore[]>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qForm, setQForm] = useState(EMPTY_QUESTION);
  const [qSubmitting, setQSubmitting] = useState(false);
  const [qFilterSkill, setQFilterSkill] = useState<Skill | 'all'>('all');

  // Resources
  const [resources, setResources] = useState<Resource[]>([]);
  const [rForm, setRForm] = useState(EMPTY_RESOURCE);
  const [editId, setEditId] = useState<string | null>(null);
  const [rSubmitting, setRSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [filterSkill, setFilterSkill] = useState<Skill | 'all'>('all');

  const [loading, setLoading] = useState(true);

  if (!isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats', token),
      api.get('/admin/users', token),
      api.get('/admin/questions', token),
      api.get('/resources', token),
    ]).then(([s, u, q, r]) => {
      setStats(s);
      setUsers(u.users);
      setQuestions(q.questions);
      setResources(r.resources);
    }).catch(() => toast('Ошибка загрузки данных', 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  // ─── Users ───────────────────────────────────────────────
  const toggleExpand = async (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userScores[userId]) {
      try {
        const data = await api.get(`/admin/users/${userId}/scores`, token);
        setUserScores(prev => ({ ...prev, [userId]: data.scores }));
      } catch {
        toast('Не удалось загрузить результаты', 'error');
      }
    }
  };

  const togglePaid = async (user: AdminUser) => {
    setTogglingId(user.id);
    try {
      const data = await api.patch(`/admin/users/${user.id}`, { has_paid: !user.has_paid }, token);
      setUsers(prev => prev.map(u => u.id === user.id ? data.user : u));
      toast(data.user.has_paid ? 'Платный доступ выдан' : 'Платный доступ отозван', 'success');
    } catch {
      toast('Ошибка изменения доступа', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // ─── Questions ────────────────────────────────────────────
  const reloadQuestions = () =>
    api.get('/admin/questions', token).then(d => setQuestions(d.questions));

  const handleAddQuestion = async () => {
    if (!qForm.text.trim()) { toast('Введите текст вопроса', 'error'); return; }
    if (qForm.options.some(o => !o.trim())) { toast('Заполните все 5 вариантов ответа', 'error'); return; }
    setQSubmitting(true);
    try {
      await api.post('/admin/questions', { ...qForm, options: qForm.options }, token);
      toast('Вопрос добавлен', 'success');
      setQForm(EMPTY_QUESTION);
      await reloadQuestions();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setQSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Удалить вопрос?')) return;
    try {
      await api.delete(`/admin/questions/${id}`, token);
      toast('Вопрос удалён', 'success');
      await reloadQuestions();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const displayedQuestions = qFilterSkill === 'all'
    ? questions
    : questions.filter(q => q.skill === qFilterSkill);

  // ─── Resources ────────────────────────────────────────────
  const reloadResources = () =>
    api.get('/resources', token).then(d => setResources(d.resources));

  const handleSubmitResource = async () => {
    if (!rForm.title || !rForm.author || !rForm.description) { toast('Заполните все поля', 'error'); return; }
    setRSubmitting(true);
    try {
      if (editId) {
        await api.patch(`/resources/${editId}`, rForm, token);
        toast('Материал обновлён', 'success');
      } else {
        await api.post('/resources', rForm, token);
        toast('Материал добавлен', 'success');
      }
      setRForm(EMPTY_RESOURCE);
      setEditId(null);
      await reloadResources();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setRSubmitting(false);
    }
  };

  const handleEditResource = (r: Resource) => {
    setEditId(r.id);
    setRForm({ title: r.title, author: r.author, description: r.description, type: r.type, skill: r.skill });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm('Удалить материал?')) return;
    try {
      await api.delete(`/resources/${id}`, token);
      toast('Удалено', 'success');
      await reloadResources();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const handleFileClick = (id: string) => { setPendingFileId(id); fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileId) return;
    setUploadingId(pendingFileId);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch(`/api/resources/${pendingFileId}/file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      toast('Файл загружен', 'success');
      await reloadResources();
    } catch {
      toast('Ошибка загрузки файла', 'error');
    } finally {
      setUploadingId(null);
      setPendingFileId(null);
      e.target.value = '';
    }
  };

  const handleRemoveFile = async (id: string) => {
    try {
      await api.delete(`/resources/${id}/file`, token);
      toast('Файл удалён', 'success');
      await reloadResources();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const displayedResources = filterSkill === 'all' ? resources : resources.filter(r => r.skill === filterSkill);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="admin-page container">
      <div className="admin-header animate-fadeUp">
        <h1 className="admin-title">Админ-панель</h1>
      </div>

      <div className="admin-tabs animate-fadeUp">
        {(['stats', 'users', 'questions', 'resources'] as Tab[]).map(t => (
          <button
            key={t}
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {{ stats: '📊 Статистика', users: '👥 Пользователи', questions: '❓ Вопросы', resources: '📚 Материалы' }[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-loading">Загрузка...</div>
      ) : (
        <>
          {/* ── STATS ── */}
          {tab === 'stats' && (
            <div className="animate-fadeUp">
              <div className="admin-stats">
                <div className="card admin-stat"><div className="admin-stat-val">{stats?.totalUsers ?? 0}</div><div className="admin-stat-label">Пользователей</div></div>
                <div className="card admin-stat"><div className="admin-stat-val">{stats?.paidUsers ?? 0}</div><div className="admin-stat-label">Платных</div></div>
                <div className="card admin-stat"><div className="admin-stat-val">{stats?.totalPayments ?? 0}</div><div className="admin-stat-label">Оплат</div></div>
                <div className="card admin-stat"><div className="admin-stat-val">{resources.length}</div><div className="admin-stat-label">Материалов</div></div>
              </div>

              {stats?.skillAverages && stats.skillAverages.length > 0 && (
                <div className="card admin-averages">
                  <h2 className="admin-section-title">Средние баллы по навыкам</h2>
                  <div className="admin-avg-list">
                    {[...stats.skillAverages].sort((a, b) => (b._avg.score ?? 0) - (a._avg.score ?? 0)).map(sa => {
                      const score = Math.round(sa._avg.score ?? 0);
                      const { label, color } = LEVEL_LABEL(score);
                      return (
                        <div key={sa.skill} className="admin-avg-row">
                          <div className="admin-avg-name">
                            {SKILL_ICONS[sa.skill as Skill]} {SKILL_LABELS[sa.skill as Skill]}
                          </div>
                          <div className="admin-avg-bar-wrap">
                            <div className="admin-avg-bar">
                              <div
                                className="admin-avg-fill"
                                style={{ width: `${score}%`, background: SKILL_COLORS[sa.skill as Skill] }}
                              />
                            </div>
                            <span className="admin-avg-score" style={{ color }}>{score}/100</span>
                            <span className="admin-avg-label" style={{ color }}>{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="animate-fadeUp">
              <div className="admin-users-toolbar">
                <input
                  className="admin-input admin-search"
                  placeholder="Поиск по имени или email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                <span className="admin-users-count">{filteredUsers.length} из {users.length}</span>
              </div>

              <div className="admin-user-list">
                {filteredUsers.map(u => (
                  <div key={u.id} className="card admin-user-item">
                    <div className="admin-user-row">
                      <div className="admin-user-avatar">
                        {(u.name ?? u.email)[0].toUpperCase()}
                      </div>
                      <div className="admin-user-info">
                        <span className="admin-user-name">{u.name ?? '—'}</span>
                        <span className="admin-user-email">{u.email}</span>
                        <span className="admin-user-date">
                          Зарегистрирован {new Date(u.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div className="admin-user-actions">
                        <span className={`admin-paid-badge ${u.has_paid ? 'paid' : 'free'}`}>
                          {u.has_paid ? 'Платный' : 'Бесплатный'}
                        </span>
                        <button
                          className={`btn ${u.has_paid ? 'btn-ghost admin-revoke-btn' : 'btn-primary'} admin-paid-btn`}
                          onClick={() => togglePaid(u)}
                          disabled={togglingId === u.id}
                        >
                          {togglingId === u.id ? '...' : u.has_paid ? 'Отозвать' : 'Выдать доступ'}
                        </button>
                        <button
                          className="btn btn-ghost admin-expand-btn"
                          onClick={() => toggleExpand(u.id)}
                        >
                          {expandedUser === u.id ? 'Скрыть ▲' : 'Результаты ▼'}
                        </button>
                      </div>
                    </div>

                    {expandedUser === u.id && (
                      <div className="admin-user-scores">
                        {!userScores[u.id] ? (
                          <div className="admin-scores-loading">Загрузка...</div>
                        ) : userScores[u.id].length === 0 ? (
                          <div className="admin-scores-empty">Тест ещё не пройден</div>
                        ) : (
                          <div className="admin-scores-grid">
                            {userScores[u.id].map(s => {
                              const { label, color } = LEVEL_LABEL(s.score);
                              return (
                                <div key={s.skill} className="admin-score-item">
                                  <div className="admin-score-name">
                                    {SKILL_ICONS[s.skill]} {SKILL_LABELS[s.skill]}
                                  </div>
                                  <div className="admin-score-bar-wrap">
                                    <div className="admin-score-bar">
                                      <div
                                        className="admin-score-fill"
                                        style={{ width: `${s.score}%`, background: SKILL_COLORS[s.skill] }}
                                      />
                                    </div>
                                    <span className="admin-score-val" style={{ color }}>{s.score}/100</span>
                                    <span className="admin-score-label" style={{ color }}>{label}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── QUESTIONS ── */}
          {tab === 'questions' && (
            <div className="animate-fadeUp">
              <div className="card admin-form">
                <h2 className="admin-form-title">Добавить вопрос</h2>
                <div className="admin-form-grid">
                  <div className="admin-field admin-field-full">
                    <label>Текст вопроса</label>
                    <textarea
                      className="admin-input admin-textarea"
                      rows={2}
                      value={qForm.text}
                      onChange={e => setQForm(f => ({ ...f, text: e.target.value }))}
                      placeholder="Как вы обычно поступаете, когда..."
                    />
                  </div>
                  <div className="admin-field">
                    <label>Навык</label>
                    <select
                      className="admin-input admin-select"
                      value={qForm.skill}
                      onChange={e => setQForm(f => ({ ...f, skill: e.target.value as Skill }))}
                    >
                      {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_ICONS[s]} {SKILL_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Порядок (order)</label>
                    <input
                      className="admin-input"
                      type="number"
                      value={qForm.order}
                      onChange={e => setQForm(f => ({ ...f, order: Number(e.target.value) }))}
                    />
                  </div>
                  {qForm.options.map((opt, i) => (
                    <div key={i} className="admin-field admin-field-full">
                      <label>Вариант {i + 1} (значение {i + 1})</label>
                      <input
                        className="admin-input"
                        value={opt}
                        onChange={e => setQForm(f => {
                          const options = [...f.options];
                          options[i] = e.target.value;
                          return { ...f, options };
                        })}
                        placeholder={`Вариант ответа ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="admin-form-actions">
                  <button className="btn btn-primary" onClick={handleAddQuestion} disabled={qSubmitting}>
                    {qSubmitting ? 'Добавление...' : 'Добавить вопрос'}
                  </button>
                </div>
              </div>

              <div className="admin-list">
                <div className="admin-list-header">
                  <h2 className="admin-list-title">Вопросы ({questions.length})</h2>
                  <div className="admin-filter">
                    <select
                      className="admin-input admin-select"
                      value={qFilterSkill}
                      onChange={e => setQFilterSkill(e.target.value as Skill | 'all')}
                    >
                      <option value="all">Все навыки</option>
                      {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>

                {displayedQuestions.length === 0 ? (
                  <div className="admin-list-empty">Нет вопросов</div>
                ) : (
                  <div className="admin-question-list">
                    {displayedQuestions.map((q, idx) => (
                      <div key={q.id} className="card admin-question-item">
                        <div className="admin-question-meta">
                          <span className="admin-resource-type">#{q.order}</span>
                          <span className="admin-resource-skill">{SKILL_ICONS[q.skill]} {SKILL_LABELS[q.skill]}</span>
                          <span className="admin-q-num">{idx + 1}</span>
                        </div>
                        <p className="admin-question-text">{q.text}</p>
                        <ol className="admin-question-options">
                          {q.options.map((opt, i) => (
                            <li key={i} className="admin-question-option">{opt}</li>
                          ))}
                        </ol>
                        <div className="admin-resource-actions">
                          <button
                            className="btn btn-ghost admin-action-btn admin-action-delete"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            🗑 Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RESOURCES ── */}
          {tab === 'resources' && (
            <div className="animate-fadeUp">
              <div className="card admin-form">
                <h2 className="admin-form-title">{editId ? 'Редактировать материал' : 'Добавить материал'}</h2>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Название</label>
                    <input className="admin-input" value={rForm.title} onChange={e => setRForm(f => ({ ...f, title: e.target.value }))} placeholder="Название книги / статьи..." />
                  </div>
                  <div className="admin-field">
                    <label>Автор / Источник</label>
                    <input className="admin-input" value={rForm.author} onChange={e => setRForm(f => ({ ...f, author: e.target.value }))} placeholder="Автор или платформа" />
                  </div>
                  <div className="admin-field admin-field-full">
                    <label>Описание</label>
                    <textarea className="admin-input admin-textarea" value={rForm.description} onChange={e => setRForm(f => ({ ...f, description: e.target.value }))} placeholder="Краткое описание материала..." rows={3} />
                  </div>
                  <div className="admin-field">
                    <label>Тип</label>
                    <select className="admin-input admin-select" value={rForm.type} onChange={e => setRForm(f => ({ ...f, type: e.target.value as ResourceType }))}>
                      {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Навык</label>
                    <select className="admin-input admin-select" value={rForm.skill} onChange={e => setRForm(f => ({ ...f, skill: e.target.value as Skill }))}>
                      {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_ICONS[s]} {SKILL_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="btn btn-primary" onClick={handleSubmitResource} disabled={rSubmitting}>
                    {rSubmitting ? 'Сохранение...' : editId ? 'Сохранить изменения' : 'Добавить'}
                  </button>
                  {editId && (
                    <button className="btn btn-ghost" onClick={() => { setEditId(null); setRForm(EMPTY_RESOURCE); }}>Отмена</button>
                  )}
                </div>
              </div>

              <div className="admin-list">
                <div className="admin-list-header">
                  <h2 className="admin-list-title">Материалы ({resources.length})</h2>
                  <div className="admin-filter">
                    <select className="admin-input admin-select" value={filterSkill} onChange={e => setFilterSkill(e.target.value as Skill | 'all')}>
                      <option value="all">Все навыки</option>
                      {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>

                {displayedResources.length === 0 ? (
                  <div className="admin-list-empty">Нет материалов</div>
                ) : (
                  <div className="admin-resource-list">
                    {displayedResources.map(r => (
                      <div key={r.id} className="card admin-resource-item">
                        <div className="admin-resource-meta">
                          <span className="admin-resource-type">{TYPE_LABEL[r.type]}</span>
                          <span className="admin-resource-skill">{SKILL_ICONS[r.skill]} {SKILL_LABELS[r.skill]}</span>
                        </div>
                        <div className="admin-resource-info">
                          <span className="admin-resource-title">{r.title}</span>
                          <span className="admin-resource-author">{r.author}</span>
                        </div>
                        <p className="admin-resource-desc">{r.description}</p>
                        <div className="admin-resource-file">
                          {r.file_url ? (
                            <>
                              <a href={r.file_url} download className="admin-file-link">⬇ Файл загружен</a>
                              <button className="btn btn-ghost admin-file-btn" onClick={() => handleRemoveFile(r.id)}>Удалить файл</button>
                            </>
                          ) : (
                            <button
                              className="btn btn-ghost admin-file-btn"
                              onClick={() => handleFileClick(r.id)}
                              disabled={uploadingId === r.id}
                            >
                              {uploadingId === r.id ? 'Загрузка...' : '+ Прикрепить файл'}
                            </button>
                          )}
                        </div>
                        <div className="admin-resource-actions">
                          <button className="btn btn-ghost admin-action-btn" onClick={() => handleEditResource(r)}>✏️ Редактировать</button>
                          <button className="btn btn-ghost admin-action-btn admin-action-delete" onClick={() => handleDeleteResource(r.id)}>🗑 Удалить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
