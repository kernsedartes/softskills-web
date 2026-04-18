import './MethodologyPage.css';

const SKILLS = [
  {
    icon: '🗣️', name: 'Коммуникация', color: '#7c6aff',
    desc: 'Оценивается способность ясно формулировать мысли, активно слушать и адаптировать стиль общения под аудиторию. Включает вербальные и невербальные аспекты.',
  },
  {
    icon: '👑', name: 'Лидерство', color: '#3ecf8e',
    desc: 'Измеряется готовность брать ответственность, мотивировать команду и принимать решения в условиях неопределённости. Не требует формальных полномочий.',
  },
  {
    icon: '📅', name: 'Самоорганизация', color: '#fbbf24',
    desc: 'Оценка планирования, управления временем и способности расставлять приоритеты. Ключевой навык для эффективной работы в любой роли.',
  },
  {
    icon: '🤝', name: 'Эмпатия', color: '#f87171',
    desc: 'Способность понимать эмоциональное состояние других людей и реагировать на него. Основа для построения доверительных отношений.',
  },
  {
    icon: '🧩', name: 'Критическое мышление', color: '#60a5fa',
    desc: 'Анализ информации, выявление противоречий и поиск нестандартных решений. Помогает избегать когнитивных искажений.',
  },
];

const STEPS = [
  { num: '01', title: 'Диагностика', desc: 'Вы отвечаете на 25 вопросов — по 5 на каждый из 5 ключевых soft skills. Вопросы разработаны на основе поведенческих индикаторов.' },
  { num: '02', title: 'Подсчёт баллов', desc: 'Каждый ответ оценивается по шкале от 1 до 4. Итоговый балл по навыку — сумма пяти ответов (максимум 20 баллов).' },
  { num: '03', title: 'Уровни развития', desc: 'Баллы переводятся в четыре уровня: «Отлично» (≥80%), «Хорошо» (≥60%), «Средне» (≥40%) и «Требует внимания» (<40%).' },
  { num: '04', title: 'Персональная программа', desc: 'На основе результатов система подбирает упражнения: сначала для слабых навыков, затем для более сильных. Платная версия включает расширенный набор заданий.' },
  { num: '05', title: 'Динамика', desc: 'При повторном прохождении теста результаты сравниваются с предыдущими. График динамики показывает прогресс по каждому навыку.' },
];

export function MethodologyPage() {
  return (
    <div className="method-page container">
      <div className="method-header animate-fadeUp">
        <h1 className="method-title">Методология</h1>
        <p className="method-sub">Как работает диагностика и что лежит в основе оценки</p>
      </div>

      <section className="method-section animate-fadeUp">
        <h2 className="method-section-title">Что мы измеряем</h2>
        <div className="method-skills">
          {SKILLS.map(s => (
            <div key={s.name} className="card method-skill-card">
              <div className="method-skill-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
              <h3 className="method-skill-name" style={{ color: s.color }}>{s.name}</h3>
              <p className="method-skill-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="method-section animate-fadeUp">
        <h2 className="method-section-title">Как устроена оценка</h2>
        <div className="method-steps">
          {STEPS.map(step => (
            <div key={step.num} className="method-step">
              <div className="method-step-num">{step.num}</div>
              <div className="method-step-body">
                <h3 className="method-step-title">{step.title}</h3>
                <p className="method-step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="method-section animate-fadeUp">
        <h2 className="method-section-title">Шкала оценки</h2>
        <div className="method-scale">
          {[
            { range: '16–20 баллов', label: 'Отлично', color: '#3ecf8e', desc: 'Навык хорошо развит. Продолжайте его применять и совершенствовать.' },
            { range: '12–15 баллов', label: 'Хорошо', color: '#7c6aff', desc: 'Базовый уровень сформирован. Есть потенциал для углублённого развития.' },
            { range: '8–11 баллов', label: 'Средне', color: '#fbbf24', desc: 'Навык требует целенаправленной работы. Рекомендуем выполнять упражнения программы.' },
            { range: '0–7 баллов', label: 'Требует внимания', color: '#f87171', desc: 'Сделайте этот навык приоритетом. Начните с базовых упражнений.' },
          ].map(item => (
            <div key={item.label} className="method-scale-item" style={{ borderLeftColor: item.color }}>
              <div className="method-scale-head">
                <span className="method-scale-label" style={{ color: item.color }}>{item.label}</span>
                <span className="method-scale-range">{item.range}</span>
              </div>
              <p className="method-scale-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
