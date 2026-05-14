// Unit-тесты для алгоритма подсчёта очков и логики вариантов теста
// Воспроизводит бизнес-логику из src/routes/test.ts без зависимостей от БД

type Variant = 'express' | 'standard' | 'extended';

const QUESTIONS_PER_SKILL: Record<Variant, number> = {
  express: 3,
  standard: 5,
  extended: 10,
};

const SKILLS = ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'];

function calculateScore(answers: number[], questionsPerSkill: number): number {
  const passing = answers.filter(v => v >= 4).length;
  return Math.round((passing / questionsPerSkill) * 100);
}

function filterByVariant(
  allQuestions: Array<{ skill: string; id: string }>,
  limit: number
): Array<{ skill: string; id: string }> {
  const countPerSkill: Record<string, number> = {};
  return allQuestions.filter(q => {
    countPerSkill[q.skill] = (countPerSkill[q.skill] ?? 0) + 1;
    return countPerSkill[q.skill] <= limit;
  });
}

describe('Алгоритм подсчёта очков', () => {
  it('возвращает 100 при всех ответах >= 4', () => {
    expect(calculateScore([4, 5, 4, 5, 4], 5)).toBe(100);
  });

  it('возвращает 0 при всех ответах < 4', () => {
    expect(calculateScore([1, 2, 3, 1, 2], 5)).toBe(0);
  });

  it('возвращает 60 при 3 из 5 ответах >= 4', () => {
    expect(calculateScore([4, 5, 4, 1, 2], 5)).toBe(60);
  });

  it('значение 4 засчитывается как "passing"', () => {
    expect(calculateScore([4], 1)).toBe(100);
  });

  it('значение 3 не засчитывается', () => {
    expect(calculateScore([3], 1)).toBe(0);
  });

  it('express: 2 из 3 правильных = 67% (Math.round)', () => {
    expect(calculateScore([4, 5, 1], QUESTIONS_PER_SKILL.express)).toBe(67);
  });

  it('extended: 7 из 10 правильных = 70%', () => {
    expect(calculateScore([4, 5, 4, 5, 4, 5, 4, 1, 2, 3], QUESTIONS_PER_SKILL.extended)).toBe(70);
  });

  it('express: 1 из 3 = 33%', () => {
    expect(calculateScore([4, 1, 1], QUESTIONS_PER_SKILL.express)).toBe(33);
  });
});

describe('Количество вопросов по вариантам', () => {
  it('express: 5 навыков × 3 вопроса = 15 итого', () => {
    expect(SKILLS.length * QUESTIONS_PER_SKILL.express).toBe(15);
  });

  it('standard: 5 навыков × 5 вопросов = 25 итого', () => {
    expect(SKILLS.length * QUESTIONS_PER_SKILL.standard).toBe(25);
  });

  it('extended: 5 навыков × 10 вопросов = 50 итого', () => {
    expect(SKILLS.length * QUESTIONS_PER_SKILL.extended).toBe(50);
  });
});

describe('Фильтрация вопросов по варианту', () => {
  const makeQuestions = (skill: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ skill, id: `${skill}-${i}` }));

  const pool = [
    ...makeQuestions('communication', 12),
    ...makeQuestions('leadership', 12),
    ...makeQuestions('self_organization', 12),
    ...makeQuestions('empathy', 12),
    ...makeQuestions('critical_thinking', 12),
  ];

  function countBySkill(questions: Array<{ skill: string }>) {
    return questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.skill] = (acc[q.skill] ?? 0) + 1;
      return acc;
    }, {});
  }

  it('express: ровно 3 вопроса на каждый навык', () => {
    const filtered = filterByVariant(pool, 3);
    const counts = countBySkill(filtered);
    SKILLS.forEach(skill => expect(counts[skill]).toBe(3));
  });

  it('standard: ровно 5 вопросов на каждый навык', () => {
    const filtered = filterByVariant(pool, 5);
    const counts = countBySkill(filtered);
    SKILLS.forEach(skill => expect(counts[skill]).toBe(5));
  });

  it('extended: ровно 10 вопросов на каждый навык, итого 50', () => {
    const filtered = filterByVariant(pool, 10);
    expect(filtered).toHaveLength(50);
  });

  it('не включает вопросы сверх лимита варианта', () => {
    const filtered = filterByVariant(pool, 5);
    expect(filtered).toHaveLength(25);
  });
});
