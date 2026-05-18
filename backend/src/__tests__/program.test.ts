// Интеграционные тесты для роутов программы развития
// Fastify.inject() — реальные HTTP без сети, Prisma замокирован

import Fastify, { FastifyInstance } from 'fastify';
import { programRoutes } from '../routes/program';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    developmentProgram: { findFirst: jest.fn() },
    programExercise: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 'user-123', email: 'test@example.com' }),
}));

const mockExercise = {
  id: 'ex-1',
  title: 'Активное слушание',
  description: 'Практика внимательного слушания собеседника',
  skill: 'communication',
  difficulty: 1,
  is_free: true,
};

const mockPE = {
  id: 'pe-1',
  status: 'not_started' as const,
  notes: null,
  started_at: null,
  completed_at: null,
  exercise: mockExercise,
};

const mockProgram = {
  id: 'prog-1',
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  exercises: [mockPE],
};

describe('Program routes', () => {
  let app: FastifyInstance;
  const authHeader = { authorization: 'Bearer mock.jwt.token' };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    app = Fastify({ logger: false });
    await app.register(programRoutes, { prefix: '/api/program' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/program ───────────────────────────────────────────────────────

  describe('GET /api/program', () => {
    it('возвращает программу с упражнениями', async () => {
      (prisma.developmentProgram.findFirst as jest.Mock).mockResolvedValue(mockProgram);

      const res = await app.inject({
        method: 'GET',
        url: '/api/program',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.program.id).toBe('prog-1');
      expect(body.program.exercises).toHaveLength(1);
    });

    it('возвращает 404 если программа не найдена', async () => {
      (prisma.developmentProgram.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/program',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toMatch(/не найдена/i);
    });

    it('возвращает 401 без заголовка Authorization', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/program' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── PATCH /api/program/exercise/:id/status ─────────────────────────────────

  describe('PATCH /api/program/exercise/:id/status', () => {
    it('not_started → in_progress: устанавливает started_at', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue({ ...mockPE, status: 'not_started' });
      (prisma.programExercise.update as jest.Mock).mockResolvedValue({
        ...mockPE,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/status',
        headers: authHeader,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.body).programExercise;
      expect(updated.status).toBe('in_progress');
      expect(updated.started_at).not.toBeNull();
    });

    it('in_progress → completed: устанавливает completed_at', async () => {
      const startedAt = new Date().toISOString();
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue({
        ...mockPE,
        status: 'in_progress',
        started_at: startedAt,
      });
      (prisma.programExercise.update as jest.Mock).mockResolvedValue({
        ...mockPE,
        status: 'completed',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/status',
        headers: authHeader,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.body).programExercise;
      expect(updated.status).toBe('completed');
      expect(updated.completed_at).not.toBeNull();
    });

    it('completed → not_started: сбрасывает completed_at в null', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue({
        ...mockPE,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      (prisma.programExercise.update as jest.Mock).mockResolvedValue({
        ...mockPE,
        status: 'not_started',
        started_at: null,
        completed_at: null,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/status',
        headers: authHeader,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).programExercise.status).toBe('not_started');
    });

    it('возвращает 404 если упражнение не принадлежит пользователю', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/foreign-pe/status',
        headers: authHeader,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it('возвращает 401 без токена', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/status',
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── PATCH /api/program/exercise/:id/notes ──────────────────────────────────

  describe('PATCH /api/program/exercise/:id/notes', () => {
    it('сохраняет текстовую заметку к упражнению', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue(mockPE);
      (prisma.programExercise.update as jest.Mock).mockResolvedValue({
        ...mockPE,
        notes: 'Отличный прогресс сегодня',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/notes',
        headers: authHeader,
        payload: { notes: 'Отличный прогресс сегодня' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).programExercise.notes).toBe('Отличный прогресс сегодня');
    });

    it('сохраняет пустую строку (удаление заметки)', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue({
        ...mockPE,
        notes: 'старая заметка',
      });
      (prisma.programExercise.update as jest.Mock).mockResolvedValue({
        ...mockPE,
        notes: '',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/pe-1/notes',
        headers: authHeader,
        payload: { notes: '' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).programExercise.notes).toBe('');
    });

    it('возвращает 404 если упражнение не найдено', async () => {
      (prisma.programExercise.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/program/exercise/nonexistent/notes',
        headers: authHeader,
        payload: { notes: 'test' },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
