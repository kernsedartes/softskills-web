import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { SkillScore, SKILL_LABELS, SKILL_ICONS, Skill } from '../types';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import './ResultsPage.css';

const MAX_SCORE = 100;

const LEVEL_LABEL = (score: number): { label: string; color: string } => {
  const pct = score / MAX_SCORE;
  if (pct >= 0.8) return { label: 'Отлично', color: '#3ecf8e' };
  if (pct >= 0.6) return { label: 'Хорошо', color: '#7c6aff' };
  if (pct >= 0.4) return { label: 'Средне', color: '#fbbf24' };
  return { label: 'Требует внимания', color: '#f87171' };
};


const SKILL_COLORS: Record<Skill, string> = {
  communication: '#7c6aff',
  leadership: '#3ecf8e',
  self_organization: '#fbbf24',
  empathy: '#f87171',
  critical_thinking: '#60a5fa',
};

interface HistoryEntry { skill: Skill; score: number; attempt: number; }

export function ResultsPage() {
  const { token, user } = useAuth();
  const [scores, setScores] = useState<SkillScore[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/test/results', token),
      api.get('/test/history', token).catch(() => ({ history: [] })),
    ]).then(([res, hist]) => {
      setScores(res.scores);
      setHistory(hist.history);
    }).catch(() => setError('Тест ещё не пройден'))
      .finally(() => setLoading(false));
  }, [token]);

  const radarData = scores.map(s => ({
    skill: SKILL_LABELS[s.skill],
    score: s.score,
    fullMark: MAX_SCORE,
  }));

  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const weakest = sorted.slice(0, 3);
  const strongest = sorted.slice(-2).reverse();

  // Build line chart data: [{attempt: 1, communication: 12, leadership: 15, ...}]
  const attempts = [...new Set(history.map(h => h.attempt))].sort();
  const lineData = attempts.map(att => {
    const row: Record<string, number | string> = { attempt: `Попытка ${att}` };
    history.filter(h => h.attempt === att).forEach(h => {
      row[h.skill] = h.score;
    });
    return row;
  });
  const hasHistory = attempts.length > 1;

  if (loading) return <div className="results-loading">Загружаем результаты...</div>;

  if (error) {
    return (
      <div className="results-empty">
        <div className="results-empty-icon">📊</div>
        <h2>Тест не пройден</h2>
        <p>Сначала пройдите диагностику, чтобы увидеть результаты.</p>
        <Link to="/test" className="btn btn-primary" style={{ marginTop: '20px' }}>Начать тест</Link>
      </div>
    );
  }

  return (
    <div className="results-page container">
      <div className="results-header animate-fadeUp">
        <h1 className="results-title">Ваши результаты</h1>
        <p className="results-sub">
          {user?.name ? `${user.name}, вот` : 'Вот'} ваш профиль soft skills по итогам диагностики
        </p>
      </div>

      <div className="results-grid animate-fadeUp">
        {/* Radar */}
        <div className="card results-radar">
          <h2 className="card-title">Профиль компетенций</h2>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarData} outerRadius="62%" margin={{ top: 24, right: 40, bottom: 24, left: 40 }}>
              <PolarGrid stroke="rgba(255,255,255,0.07)" />
              <PolarRadiusAxis
                domain={[0, MAX_SCORE]}
                tickCount={6}
                tick={{ fill: 'rgba(240,238,255,0.3)', fontSize: 9 }}
                axisLine={false}
              />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fill: 'rgba(240,238,255,0.65)', fontSize: 12, fontFamily: 'Inter' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
                formatter={(v: number) => [`${v} / ${MAX_SCORE}`, 'Баллы']}
              />
              <Legend
                formatter={() => 'Ваш уровень'}
                wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
              />
              <Radar
                name="score"
                dataKey="score"
                stroke="#7c6aff"
                fill="#7c6aff"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ fill: '#7c6aff', r: 3 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary cards */}
        <div className="results-summary">
          <div className="card summary-card summary-weak">
            <div className="summary-label">🎯 Зоны роста</div>
            {weakest.map(s => (
              <div key={s.skill} className="summary-skill">
                <span>{SKILL_ICONS[s.skill]} {SKILL_LABELS[s.skill]}</span>
                <span className="summary-score" style={{ color: LEVEL_LABEL(s.score).color }}>
                  {s.score}/{MAX_SCORE}
                </span>
              </div>
            ))}
          </div>
          <div className="card summary-card summary-strong">
            <div className="summary-label">⭐ Сильные стороны</div>
            {strongest.map(s => (
              <div key={s.skill} className="summary-skill">
                <span>{SKILL_ICONS[s.skill]} {SKILL_LABELS[s.skill]}</span>
                <span className="summary-score" style={{ color: LEVEL_LABEL(s.score).color }}>
                  {s.score}/{MAX_SCORE}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamics chart */}
        <div className="card results-dynamics">
          <div className="dynamics-header">
            <h2 className="card-title">Динамика навыков</h2>
            {!hasHistory && (
              <span className="dynamics-hint">
                {user?.has_paid ? 'Пройдите тест ещё раз чтобы увидеть динамику' : 'Доступно после повторного прохождения теста'}
              </span>
            )}
          </div>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="attempt" tick={{ fill: 'rgba(240,238,255,0.45)', fontSize: 11 }} />
                <YAxis domain={[0, MAX_SCORE]} tick={{ fill: 'rgba(240,238,255,0.45)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                  formatter={(v: number, name: string) => [`${v}/${MAX_SCORE}`, SKILL_LABELS[name as Skill] ?? name]}
                />
                <Legend
                  formatter={(name: string) => SKILL_LABELS[name as Skill] ?? name}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                {(Object.keys(SKILL_COLORS) as Skill[]).map(skill => (
                  <Line
                    key={skill}
                    type="monotone"
                    dataKey={skill}
                    stroke={SKILL_COLORS[skill]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: SKILL_COLORS[skill] }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="dynamics-empty">
              <div className="dynamics-preview">
                {(Object.keys(SKILL_COLORS) as Skill[]).map(skill => (
                  <div key={skill} className="dynamics-preview-row">
                    <span style={{ color: SKILL_COLORS[skill] }}>● {SKILL_LABELS[skill]}</span>
                    <div className="dynamics-preview-bar">
                      <div style={{ width: `${(scores.find(s => s.skill === skill)?.score ?? 0) / MAX_SCORE * 100}%`, background: SKILL_COLORS[skill] }} />
                    </div>
                    <span className="dynamics-preview-score">{scores.find(s => s.skill === skill)?.score ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="results-cta">
          <Link to="/program" className="btn btn-primary results-cta-btn">
            Открыть программу развития →
          </Link>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            Скачать PDF
          </button>
          {!user?.has_paid && (
            <Link to="/payment" className="btn btn-ghost">
              ⚡ Расширенный доступ — 299 ₽
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
