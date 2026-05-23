// Интеграционные тесты для роутов прохождения теста
// Fastify.inject() — реальные HTTP без сети, Prisma и generateProgram замоканы

import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { testRoutes } from '../routes/test';
import { prisma } from '../lib/prisma';
import { generateProgram } from '../services/recommendation';

jest.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    question: { findMany: jest.fn() },
    skillScore: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    skillScoreHistory: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    userAnswer: { upsert: jest.fn() },
  },
}));

jest.mock('../services/recommendation', () => ({
  generateProgram: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', email: 'test@example.com' }),
}));

const SKILLS = ['communication', 'leadership', 'self_organization', 'empathy', 'critical_thinking'];

function makeQuestions(total: number) {
  return Array.from({ length: total }, (_, i) => ({
    id: `q-${i}`,
    text: `Question ${i}`,
    skill: SKILLS[Math.floor(i / (total / 5))],
    options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'],
    order: i,
  }));
}

describe('Test routes', () => {
  let app: FastifyInstance;
  const authHeader = { cookie: 'token=mock.jwt.token' };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(testRoutes, { prefix: '/api/test' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/test/questions ────────────────────────────────────────────────

  describe('GET /api/test/questions', () => {
    it('возвращает вопросы и вариант standard по умолчанию', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });
      (prisma.skillScore.count as jest.Mock).mockResolvedValue(0);
      (prisma.question.findMany as jest.Mock).mockResolvedValue(makeQuestions(50));

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/questions',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.variant).toBe('standard');
      expect(body.questionsPerSkill).toBe(5);
      expect(Array.isArray(body.questions)).toBe(true);
    });

    it('возвращает questionsPerSkill=3 для варианта express', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });
      (prisma.skillScore.count as jest.Mock).mockResolvedValue(0);
      (prisma.question.findMany as jest.Mock).mockResolvedValue(makeQuestions(50));

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/questions?variant=express',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.variant).toBe('express');
      expect(body.questionsPerSkill).toBe(3);
    });

    it('возвращает questionsPerSkill=10 для варианта extended', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });
      (prisma.skillScore.count as jest.Mock).mockResolvedValue(0);
      (prisma.question.findMany as jest.Mock).mockResolvedValue(makeQuestions(50));

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/questions?variant=extended',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).questionsPerSkill).toBe(10);
    });

    it('возвращает 403 retake_locked для бесплатного пользователя, уже прошедшего тест', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });
      (prisma.skillScore.count as jest.Mock).mockResolvedValue(5);

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/questions',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('retake_locked');
    });

    it('не блокирует платного пользователя при повторном прохождении', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: true });
      (prisma.skillScore.count as jest.Mock).mockResolvedValue(5);
      (prisma.question.findMany as jest.Mock).mockResolvedValue(makeQuestions(50));

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/questions',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test/questions' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/test/results ──────────────────────────────────────────────────

  describe('GET /api/test/results', () => {
    it('возвращает результаты если тест пройден', async () => {
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', skill: 'communication', score: 80 },
        { id: 's2', skill: 'leadership', score: 60 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/results',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).scores).toHaveLength(2);
    });

    it('возвращает 404 если тест ещё не пройден', async () => {
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/results',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toMatch(/не пройден/i);
    });
  });

  // ─── GET /api/test/history ──────────────────────────────────────────────────

  describe('GET /api/test/history', () => {
    it('возвращает историю прохождений', async () => {
      (prisma.skillScoreHistory.findMany as jest.Mock).mockResolvedValue([
        { skill: 'communication', score: 60, attempt: 1 },
        { skill: 'leadership', score: 40, attempt: 1 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/history',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).history).toHaveLength(2);
    });

    it('возвращает пустой массив если истории нет', async () => {
      (prisma.skillScoreHistory.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/test/history',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).history).toHaveLength(0);
    });
  });

  // ─── POST /api/test/submit ──────────────────────────────────────────────────

  describe('POST /api/test/submit', () => {
    it('возвращает 400 если количество ответов не совпадает с вариантом standard (25)', async () => {
      (prisma.question.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/test/submit',
        headers: authHeader,
        payload: { answers: [{ questionId: 'q-1', value: 4 }], variant: 'standard' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/25/);
    });

    it('возвращает 400 если количество ответов не совпадает с вариантом express (15)', async () => {
      (prisma.question.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/test/submit',
        headers: authHeader,
        payload: { answers: [], variant: 'express' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/15/);
    });

    it('успешно сохраняет результаты и вызывает generateProgram', async () => {
      const questions = makeQuestions(15);

      (prisma.question.findMany as jest.Mock).mockResolvedValue(questions);
      (prisma.userAnswer.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScoreHistory.count as jest.Mock).mockResolvedValue(0);
      (prisma.skillScoreHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue(
        SKILLS.map(skill => ({ skill, score: 100 }))
      );

      const answers = questions.map(q => ({ questionId: q.id, value: 5 }));

      const res = await app.inject({
        method: 'POST',
        url: '/api/test/submit',
        headers: authHeader,
        payload: { answers, variant: 'express' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/успешно/i);
      expect(generateProgram).toHaveBeenCalledWith(
        'user-123',
        expect.any(Object),
        false
      );
    });

    it('передаёт has_paid=true в generateProgram для платного пользователя', async () => {
      const questions = makeQuestions(15);

      (prisma.question.findMany as jest.Mock).mockResolvedValue(questions);
      (prisma.userAnswer.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScoreHistory.count as jest.Mock).mockResolvedValue(0);
      (prisma.skillScoreHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: true });
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue(
        SKILLS.map(skill => ({ skill, score: 100 }))
      );

      const answers = questions.map(q => ({ questionId: q.id, value: 5 }));

      await app.inject({
        method: 'POST',
        url: '/api/test/submit',
        headers: authHeader,
        payload: { answers, variant: 'express' },
      });

      expect(generateProgram).toHaveBeenCalledWith('user-123', expect.any(Object), true);
    });

    it('корректно считает скор: 2 из 3 вопросов >= 4 = 67% для express', async () => {
      const questions = makeQuestions(15);

      (prisma.question.findMany as jest.Mock).mockResolvedValue(questions);
      (prisma.userAnswer.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.upsert as jest.Mock).mockResolvedValue({});
      (prisma.skillScoreHistory.count as jest.Mock).mockResolvedValue(0);
      (prisma.skillScoreHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123', has_paid: false });

      const capturedSkillTotals: Record<string, number> = {};
      (prisma.skillScore.upsert as jest.Mock).mockImplementation(({ where, create }) => {
        capturedSkillTotals[create.skill] = create.score;
        return Promise.resolve({});
      });
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([]);

      // 3 вопроса per skill, answers: [4,5,1] → 2 из 3 passing = 67%
      const answers = questions.map((q, i) => ({
        questionId: q.id,
        value: i % 3 === 2 ? 1 : 5, // каждый третий вопрос — неправильный
      }));

      await app.inject({
        method: 'POST',
        url: '/api/test/submit',
        headers: authHeader,
        payload: { answers, variant: 'express' },
      });

      for (const score of Object.values(capturedSkillTotals)) {
        expect(score).toBe(67);
      }
    });
  });
});
