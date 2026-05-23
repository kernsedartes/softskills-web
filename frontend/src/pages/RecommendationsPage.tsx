import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Resource, ResourceType, Skill, SKILL_LABELS, SKILL_ICONS } from '../types';
import { SkeletonCard } from '../components/Skeleton';
import './RecommendationsPage.css';

const TYPE_LABEL: Record<ResourceType, string> = {
  book: 'Книга', article: 'Статья', video: 'Видео', course: 'Курс',
};
const TYPE_ICON: Record<ResourceType, string> = {
  book: '📚', article: '📝', video: '▶️', course: '🎓',
};

const SKILLS = ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'] as Skill[];

export function RecommendationsPage() {
  const { isAdmin } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSkill, setActiveSkill] = useState<Skill>('communication');
  const [activeType, setActiveType] = useState<ResourceType | 'all'>('all');

  useEffect(() => {
    api.get('/resources')
      .then(d => setResources(d.resources))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = resources.filter(r =>
    r.skill === activeSkill && (activeType === 'all' || r.type === activeType)
  );

  return (
    <div className="rec-page container">
      <div className="rec-header animate-fadeUp">
        <div>
          <h1 className="rec-title">Рекомендации</h1>
          <p className="rec-sub">Книги, статьи, видео и курсы для развития каждого навыка</p>
        </div>
        {isAdmin && (
          <Link to="/admin" className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: '14px', padding: '10px 20px' }}>
            ⚙️ Управление материалами
          </Link>
        )}
      </div>

      <div className="rec-skills animate-fadeUp">
        {SKILLS.map(skill => (
          <button
            key={skill}
            className={`rec-skill-btn${activeSkill === skill ? ' active' : ''}`}
            onClick={() => setActiveSkill(skill)}
          >
            {SKILL_ICONS[skill]} {SKILL_LABELS[skill]}
          </button>
        ))}
      </div>

      <div className="rec-filters animate-fadeUp">
        {(['all', 'book', 'article', 'video', 'course'] as const).map(t => (
          <button
            key={t}
            className={`rec-filter-btn${activeType === t ? ' active' : ''}`}
            onClick={() => setActiveType(t)}
          >
            {t === 'all' ? 'Все' : `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rec-grid">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rec-empty">
          <p>Материалов пока нет.</p>
          {isAdmin && <Link to="/admin" className="btn btn-ghost" style={{ marginTop: '12px' }}>Добавить первый материал</Link>}
        </div>
      ) : (
        <div className="rec-grid animate-fadeUp">
          {filtered.map(r => (
            <div key={r.id} className="card rec-card">
              <div className="rec-card-type">
                <span className="rec-type-badge">{TYPE_ICON[r.type]} {TYPE_LABEL[r.type]}</span>
              </div>
              <h3 className="rec-card-title">{r.title}</h3>
              <p className="rec-card-author">{r.author}</p>
              <p className="rec-card-desc">{r.description}</p>
              {r.file_url && (
                <a
                  href={r.file_url}
                  download
                  className="btn btn-ghost rec-download-btn"
                >
                  ⬇ Скачать файл
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
