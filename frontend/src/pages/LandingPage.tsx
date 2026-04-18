import { Link } from 'react-router-dom';
import { SKILL_ICONS, SKILL_LABELS, Skill } from '../types';
import './LandingPage.css';

const skills = Object.keys(SKILL_LABELS) as Skill[];

const steps = [
  { n: '01', title: 'Пройдите тест', desc: '25 вопросов по 5 ключевым soft skills. Занимает 10–12 минут.' },
  { n: '02', title: 'Получите результат', desc: 'Радарная диаграмма покажет ваши сильные стороны и зоны роста.' },
  { n: '03', title: 'Развивайтесь', desc: 'Персональная программа из упражнений подбирается под ваш профиль и расширяется после оплаты.' },
];

export function LandingPage() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-inner animate-fadeUp">
          <div className="hero-badge">Диагностика · Развитие · Результат</div>
          <h1 className="hero-title">
            Узнайте свой<br />
            <span className="hero-accent">soft skills профиль</span>
          </h1>
          <p className="hero-desc">
            Бесплатный тест на 25 вопросов. Автоматически формируется персональная программа развития.
            Никаких приложений — работает прямо в браузере.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary hero-cta">
              Начать бесплатно →
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Уже есть аккаунт
            </Link>
          </div>
          <p className="hero-note">Базовый доступ бесплатно · Расширенный — 299 ₽ разово</p>
        </div>
      </section>

      {/* Skills grid */}
      <section className="section container">
        <h2 className="section-title">Пять компетенций</h2>
        <p className="section-sub">Диагностируем ключевые навыки, которые ценят работодатели</p>
        <div className="skills-grid">
          {skills.map((skill, i) => (
            <div
              key={skill}
              className={`skill-card card skill-${skill}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="skill-icon">{SKILL_ICONS[skill]}</div>
              <div className="skill-name">{SKILL_LABELS[skill]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section container">
        <h2 className="section-title">Как это работает</h2>
        <div className="steps">
          {steps.map((step, i) => (
            <div key={i} className="step card">
              <div className="step-number">{step.n}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="section container">
        <h2 className="section-title">Тарифы</h2>
        <div className="pricing">
          <div className="pricing-card card">
            <div className="pricing-plan">Базовый</div>
            <div className="pricing-price">Бесплатно</div>
            <ul className="pricing-features">
              <li>✓ Полный тест (25 вопросов)</li>
              <li>✓ Результаты по 5 навыкам</li>
              <li>✓ Программа из 6 базовых упражнений</li>
              <li className="dim">✗ Расширенная аналитика</li>
              <li className="dim">✗ Платные упражнения</li>
            </ul>
            <Link to="/register" className="btn btn-ghost" style={{ width: '100%' }}>
              Начать
            </Link>
          </div>
          <div className="pricing-card card pricing-card-featured">
            <div className="pricing-badge">Лучший выбор</div>
            <div className="pricing-plan">Расширенный</div>
            <div className="pricing-price">299 ₽ <span>разово</span></div>
            <ul className="pricing-features">
              <li>✓ Всё из базового</li>
              <li>✓ Расширенная аналитика</li>
              <li>✓ Программа из 9 упражнений</li>
              <li>✓ Детальные рекомендации</li>
              <li>✓ Доступ навсегда</li>
            </ul>
            <Link to="/register" className="btn btn-primary" style={{ width: '100%' }}>
              Получить доступ
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="navbar-logo-icon" style={{ color: 'var(--accent)' }}>◈</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>SoftSkills — дипломный проект СПбГЭТУ «ЛЭТИ» 2026</span>
        </div>
      </footer>
    </div>
  );
}
