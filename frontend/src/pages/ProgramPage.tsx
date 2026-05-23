import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { DevelopmentProgram, ProgramExercise, SKILL_LABELS, SKILL_ICONS, Skill, ExerciseStatus } from '../types';
import './ProgramPage.css';

const DIFFICULTY_LABELS = ['', 'Начальный', 'Средний', 'Продвинутый'];

const STATUS_LABELS: Record<ExerciseStatus, string> = {
  not_started: 'Не начато',
  in_progress: 'В процессе',
  completed: 'Выполнено',
};

const STATUS_NEXT_LABEL: Record<ExerciseStatus, string> = {
  not_started: 'Начать',
  in_progress: 'Завершить',
  completed: 'Сбросить',
};

export function ProgramPage() {
  const { user } = useAuth();
  const [program, setProgram] = useState<DevelopmentProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  useEffect(() => {
    api.get('/program')
      .then(data => {
        setProgram(data.program);
        const drafts: Record<string, string> = {};
        for (const pe of data.program.exercises) {
          drafts[pe.id] = pe.notes ?? '';
        }
        setNotesDraft(drafts);
      })
      .catch(() => setError('no-program'))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (peId: string) => {
    if (toggling) return;
    setToggling(peId);
    try {
      const data = await api.patch(`/program/exercise/${peId}/status`, {});
      setProgram(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map(pe =>
            pe.id === peId ? { ...pe, ...data.programExercise } : pe
          ),
        };
      });
    } catch {
      // silent
    } finally {
      setToggling(null);
    }
  };

  const handleSaveNotes = async (peId: string) => {
    setSavingNotes(peId);
    try {
      const notes = notesDraft[peId] ?? '';
      await api.patch(`/program/exercise/${peId}/notes`, { notes });
      setProgram(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map(pe =>
            pe.id === peId ? { ...pe, notes } : pe
          ),
        };
      });
      setEditingNotes(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(null);
    }
  };

  if (loading) return <div className="program-loading">Загружаем программу...</div>;

  if (error === 'no-program') {
    return (
      <div className="program-empty container">
        <div className="program-empty-icon">🎯</div>
        <h2>Программа не сформирована</h2>
        <p>Пройдите тест — система автоматически подберёт упражнения под ваш профиль.</p>
        <Link to="/test" className="btn btn-primary" style={{ marginTop: '20px' }}>Пройти тест</Link>
      </div>
    );
  }

  if (!program) return null;

  const bySkill: Record<string, ProgramExercise[]> = {};
  for (const pe of program.exercises) {
    const s = pe.exercise.skill;
    if (!bySkill[s]) bySkill[s] = [];
    bySkill[s].push(pe);
  }

  const completed = program.exercises.filter(pe => pe.status === 'completed').length;
  const inProgress = program.exercises.filter(pe => pe.status === 'in_progress').length;
  const total = program.exercises.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const hasLocked = program.exercises.some(pe => !pe.exercise.is_free);

  return (
    <div className="program-page container">
      <div className="program-header animate-fadeUp">
        <div>
          <h1 className="program-title">Программа развития</h1>
          <p className="program-sub">
            Сформирована по результатам диагностики · {total} упражнений
          </p>
        </div>
        <div className="program-progress-block">
          <div className="program-progress-label">
            <span>Выполнено</span>
            <span className="program-progress-pct">{completed}/{total}</span>
          </div>
          <div className="program-progress-track">
            <div className="program-progress-fill" style={{ width: `${pct}%` }} />
            {inProgress > 0 && (
              <div className="program-progress-inprogress" style={{ width: `${Math.round((inProgress / total) * 100)}%` }} />
            )}
          </div>
          <div className="program-progress-legend">
            {inProgress > 0 && <span className="legend-inprogress">В процессе: {inProgress}</span>}
            {completed > 0 && <span className="legend-completed">Выполнено: {completed}</span>}
          </div>
        </div>
      </div>

      {hasLocked && !user?.has_paid && (
        <div className="program-upsell animate-fadeUp">
          <div className="program-upsell-text">
            <span>🔒</span>
            <div>
              <strong>Часть упражнений недоступна</strong>
              <p>Откройте полную программу с расширенными упражнениями за 299 ₽ разово</p>
            </div>
          </div>
          <Link to="/payment" className="btn btn-primary program-upsell-btn">Открыть всё</Link>
        </div>
      )}

      <div className="program-skills animate-fadeUp">
        {Object.entries(bySkill).map(([skill, items]) => {
          const skillCompleted = items.filter(p => p.status === 'completed').length;
          const skillInProgress = items.filter(p => p.status === 'in_progress').length;
          const skillPct = items.length ? Math.round((skillCompleted / items.length) * 100) : 0;

          return (
            <div key={skill} className={`program-skill-group skill-${skill}`}>
              <div className="program-skill-head">
                <span className="program-skill-icon">{SKILL_ICONS[skill as Skill]}</span>
                <span className="program-skill-name">{SKILL_LABELS[skill as Skill]}</span>
                <div className="program-skill-stats">
                  {skillInProgress > 0 && <span className="skill-stat-progress">●</span>}
                  <span className="program-skill-count">{skillCompleted}/{items.length}</span>
                </div>
              </div>
              <div className="skill-progress-track">
                <div className="skill-progress-fill" style={{ width: `${skillPct}%` }} />
              </div>
              <div className="program-exercises">
                {items.map(pe => {
                  const isLocked = !pe.exercise.is_free && !user?.has_paid;

                  return (
                    <div key={pe.id} className={`exercise-card card status-${pe.status} ${isLocked ? 'locked' : ''}`}>
                      {isLocked ? (
                        <>
                          <div className="exercise-lock">🔒</div>
                          <div className="exercise-body">
                            <div className="exercise-title">{pe.exercise.title}</div>
                            <div className="exercise-level">{DIFFICULTY_LABELS[pe.exercise.difficulty]} · Расширенный доступ</div>
                          </div>
                          <Link to="/payment" className="exercise-unlock-btn">Открыть</Link>
                        </>
                      ) : (
                        <>
                          <div className="exercise-main">
                            <div className="exercise-body">
                              <div className="exercise-title-row">
                                <div className="exercise-title">{pe.exercise.title}</div>
                                <span className={`exercise-status-badge status-${pe.status}`}>
                                  {STATUS_LABELS[pe.status]}
                                </span>
                              </div>
                              <div className="exercise-desc">{pe.exercise.description}</div>
                              <div className="exercise-meta">
                                <span className="exercise-level">{DIFFICULTY_LABELS[pe.exercise.difficulty]}</span>
                                {pe.started_at && (
                                  <span className="exercise-date">
                                    Начато: {new Date(pe.started_at).toLocaleDateString('ru-RU')}
                                  </span>
                                )}
                                {pe.completed_at && (
                                  <span className="exercise-date">
                                    Завершено: {new Date(pe.completed_at).toLocaleDateString('ru-RU')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {pe.status !== 'not_started' && (
                            <div className="exercise-notes">
                              {editingNotes === pe.id ? (
                                <>
                                  <textarea
                                    className="exercise-notes-input"
                                    placeholder="Заметки и рефлексия..."
                                    value={notesDraft[pe.id] ?? ''}
                                    onChange={e => setNotesDraft(prev => ({ ...prev, [pe.id]: e.target.value }))}
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="exercise-notes-footer">
                                    <button
                                      className="btn btn-ghost exercise-notes-cancel"
                                      onClick={() => setEditingNotes(null)}
                                      disabled={savingNotes === pe.id}
                                    >
                                      Отмена
                                    </button>
                                    <button
                                      className="btn btn-primary exercise-notes-save"
                                      onClick={() => handleSaveNotes(pe.id)}
                                      disabled={savingNotes === pe.id}
                                    >
                                      {savingNotes === pe.id ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="exercise-notes-view">
                                  {pe.notes
                                    ? <p className="exercise-notes-text">{pe.notes}</p>
                                    : <p className="exercise-notes-empty">Нет заметок</p>
                                  }
                                  <button
                                    className="btn btn-ghost exercise-notes-edit"
                                    onClick={() => {
                                      setNotesDraft(prev => ({ ...prev, [pe.id]: pe.notes ?? '' }));
                                      setEditingNotes(pe.id);
                                    }}
                                  >
                                    {pe.notes ? '✏️ Редактировать' : '+ Добавить заметку'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="exercise-actions">
                            <button
                              className={`btn exercise-status-btn status-btn-${pe.status}`}
                              onClick={() => handleStatusChange(pe.id)}
                              disabled={toggling === pe.id}
                            >
                              {toggling === pe.id ? '...' : STATUS_NEXT_LABEL[pe.status]}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pct === 100 && (
        <div className="program-complete card animate-fadeUp">
          <span>🎉</span>
          <div>
            <strong>Программа выполнена!</strong>
            <p>Пройдите тест заново, чтобы оценить прогресс и получить новую программу.</p>
          </div>
          <Link to="/test" className="btn btn-green">Новый тест</Link>
        </div>
      )}
    </div>
  );
}
