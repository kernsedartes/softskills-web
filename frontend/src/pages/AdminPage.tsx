import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { Resource, ResourceType, Skill, SKILL_LABELS, SKILL_ICONS } from '../types';
import './AdminPage.css';

const TYPE_OPTIONS: ResourceType[] = ['book', 'article', 'video', 'course'];
const TYPE_LABEL: Record<ResourceType, string> = { book: 'Книга', article: 'Статья', video: 'Видео', course: 'Курс' };
const SKILL_OPTIONS: Skill[] = ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'];

const EMPTY_FORM = { title: '', author: '', description: '', type: 'book' as ResourceType, skill: 'communication' as Skill };

interface Stats {
  totalUsers: number;
  paidUsers: number;
  totalPayments: number;
}

export function AdminPage() {
  const { isAdmin, token } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // file upload
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);

  // filter
  const [filterSkill, setFilterSkill] = useState<Skill | 'all'>('all');

  if (!isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats', token),
      api.get('/resources', token),
    ]).then(([s, r]) => {
      setStats(s);
      setResources(r.resources);
    }).catch(() => toast('Ошибка загрузки данных', 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  const reload = () =>
    api.get('/resources', token).then(d => setResources(d.resources));

  const handleSubmit = async () => {
    if (!form.title || !form.author || !form.description) {
      toast('Заполните все поля', 'error'); return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        await api.patch(`/resources/${editId}`, form, token);
        toast('Материал обновлён', 'success');
      } else {
        await api.post('/resources', form, token);
        toast('Материал добавлен', 'success');
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      await reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (r: Resource) => {
    setEditId(r.id);
    setForm({ title: r.title, author: r.author, description: r.description, type: r.type, skill: r.skill });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить материал?')) return;
    try {
      await api.delete(`/resources/${id}`, token);
      toast('Удалено', 'success');
      await reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const handleFileClick = (id: string) => {
    setPendingFileId(id);
    fileInputRef.current?.click();
  };

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
      await reload();
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
      await reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const displayed = filterSkill === 'all' ? resources : resources.filter(r => r.skill === filterSkill);

  return (
    <div className="admin-page container">
      <div className="admin-header animate-fadeUp">
        <h1 className="admin-title">Админ-панель</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats animate-fadeUp">
          <div className="card admin-stat"><div className="admin-stat-val">{stats.totalUsers}</div><div className="admin-stat-label">Пользователей</div></div>
          <div className="card admin-stat"><div className="admin-stat-val">{stats.paidUsers}</div><div className="admin-stat-label">Платных</div></div>
          <div className="card admin-stat"><div className="admin-stat-val">{stats.totalPayments}</div><div className="admin-stat-label">Оплат</div></div>
          <div className="card admin-stat"><div className="admin-stat-val">{resources.length}</div><div className="admin-stat-label">Материалов</div></div>
        </div>
      )}

      {/* Form */}
      <div className="card admin-form animate-fadeUp">
        <h2 className="admin-form-title">{editId ? 'Редактировать материал' : 'Добавить материал'}</h2>
        <div className="admin-form-grid">
          <div className="admin-field">
            <label>Название</label>
            <input className="admin-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Название книги / статьи..." />
          </div>
          <div className="admin-field">
            <label>Автор / Источник</label>
            <input className="admin-input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Автор или платформа" />
          </div>
          <div className="admin-field admin-field-full">
            <label>Описание</label>
            <textarea className="admin-input admin-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Краткое описание материала..." rows={3} />
          </div>
          <div className="admin-field">
            <label>Тип</label>
            <select className="admin-input admin-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ResourceType }))}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label>Навык</label>
            <select className="admin-input admin-select" value={form.skill} onChange={e => setForm(f => ({ ...f, skill: e.target.value as Skill }))}>
              {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_ICONS[s]} {SKILL_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-form-actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Сохранение...' : editId ? 'Сохранить изменения' : 'Добавить'}
          </button>
          {editId && (
            <button className="btn btn-ghost" onClick={() => { setEditId(null); setForm(EMPTY_FORM); }}>
              Отмена
            </button>
          )}
        </div>
      </div>

      {/* Resource list */}
      <div className="admin-list animate-fadeUp">
        <div className="admin-list-header">
          <h2 className="admin-list-title">Материалы ({resources.length})</h2>
          <div className="admin-filter">
            <select className="admin-input admin-select" value={filterSkill} onChange={e => setFilterSkill(e.target.value as Skill | 'all')}>
              <option value="all">Все навыки</option>
              {SKILL_OPTIONS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-list-empty">Загрузка...</div>
        ) : displayed.length === 0 ? (
          <div className="admin-list-empty">Нет материалов</div>
        ) : (
          <div className="admin-resource-list">
            {displayed.map(r => (
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
                  <button className="btn btn-ghost admin-action-btn" onClick={() => handleEdit(r)}>✏️ Редактировать</button>
                  <button className="btn btn-ghost admin-action-btn admin-action-delete" onClick={() => handleDelete(r.id)}>🗑 Удалить</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}
