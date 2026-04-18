import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { SkillScore, SKILL_LABELS, SKILL_ICONS } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { SkeletonCard } from '../components/Skeleton';
import './DashboardPage.css';

export function DashboardPage() {
  const { user, token } = useAuth();
  const [scores, setScores] = useState<SkillScore[]>([]);
  const [hasTest, setHasTest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exerciseCount, setExerciseCount] = useState<number | null>(null);

  useEffect(() => {
    api.get('/test/results', token)
      .then(data => { setScores(data.scores); setHasTest(true); })
      .catch(() => setHasTest(false))
      .finally(() => setLoading(false));

    api.get('/program', token)
      .then(data => setExerciseCount(data.program.exercises.length))
      .catch(() => {});
  }, [token]);

  const radarData = scores.map(s => ({
    skill: SKILL_LABELS[s.skill],
    score: s.score,
    fullMark: 20,
  }));

  const maxScore = 20;

  if (loading) {
    return (
      <div className="dashboard container" style={{ paddingTop: '48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard container">
      {hasTest && (
        <div className="dashboard-header animate-fadeUp">
          <div>
            <h1 className="dashboard-title">
              {user?.name ? `Привет, ${user.name}!` : 'Главная'}
            </h1>
            <p className="dashboard-sub">Ваш текущий профиль компетенций</p>
          </div>
          {!user?.has_paid && (
            <Link to="/payment" className="dashboard-upgrade-btn">
              ⚡ Расширенный доступ — 299 ₽
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading">Загрузка...</div>
      ) : !hasTest ? (
        /* No test yet */
        <div className="no-test animate-fadeUp">
          <div className="no-test-icon">📊</div>
          <h2 className="no-test-title">Тест ещё не пройден</h2>
          <p className="no-test-desc">Пройдите диагностику из 25 вопросов, чтобы узнать свой профиль soft skills и получить персональную программу развития.</p>
          <Link to="/test" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '16px' }}>
            Начать тест →
          </Link>
        </div>
      ) : (
        <div className="dashboard-content animate-fadeUp">
          {/* Radar chart */}
          <div className="card dashboard-radar">
            <h2 className="card-title">Профиль навыков</h2>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: 'rgba(240,238,255,0.55)', fontSize: 12, fontFamily: 'Inter' }}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                  formatter={(v: number) => [`${v} / ${maxScore}`, 'Баллы']}
                />
                <Radar
                  dataKey="score"
                  stroke="#7c6aff"
                  fill="#7c6aff"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Skill bars */}
          <div className="card dashboard-bars">
            <h2 className="card-title">Детально по навыкам</h2>
            <div className="bars-list">
              {scores
                .slice()
                .sort((a, b) => b.score - a.score)
                .map(s => {
                  const pct = Math.round((s.score / maxScore) * 100);
                  return (
                    <div key={s.skill} className={`bar-item skill-${s.skill}`}>
                      <div className="bar-label">
                        <span>{SKILL_ICONS[s.skill]} {SKILL_LABELS[s.skill]}</span>
                        <span className="bar-score">{s.score} / {maxScore}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${pct}%`, background: 'var(--skill-color)' }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Actions */}
          <div className="dashboard-actions">
            <Link to="/program" className="action-card card">
              <div className="action-icon">🎯</div>
              <div>
                <div className="action-title">Моя программа</div>
                <div className="action-desc">{exerciseCount !== null ? `${exerciseCount} упражнений` : 'Упражнения'} под ваш профиль</div>
              </div>
              <span className="action-arrow">→</span>
            </Link>
            <Link to="/test" className="action-card card">
              <div className="action-icon">🔄</div>
              <div>
                <div className="action-title">Пройти тест заново</div>
                <div className="action-desc">Обновить профиль навыков</div>
              </div>
              <span className="action-arrow">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
