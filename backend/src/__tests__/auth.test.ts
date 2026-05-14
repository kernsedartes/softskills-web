// Интеграционные тесты для роутов аутентификации
// Используют Fastify.inject() — реальные HTTP без сети, Prisma замокирован

import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from '../routes/auth';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    skillScore: { findMany: jest.fn() },
    developmentProgram: { findFirst: jest.fn() },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$mockhash'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', email: 'test@example.com' }),
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn().mockReturnValue(false),
  unlinkSync: jest.fn(),
}));

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    app = Fastify({ logger: false });
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Регистрация ────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('успешно создаёт пользователя и возвращает JWT', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'new@example.com',
        name: 'Иван',
        has_paid: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'new@example.com', password: 'password123', name: 'Иван' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('mock.jwt.token');
      expect(body.user.email).toBe('new@example.com');
    });

    it('возвращает 409 если email уже занят', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-user' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'taken@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toMatch(/уже существует/);
    });

    it('возвращает 400 если пароль короче 6 символов', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com', password: '123' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/6 символов/);
    });

    it('возвращает 400 если пароль не передан', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'test@example.com' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Вход ────────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const existingUser = {
      id: 'user-123',
      email: 'user@example.com',
      password: '$2a$10$mockhash',
      name: 'Иван',
      has_paid: false,
    };

    it('возвращает JWT при верных данных', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user@example.com', password: 'correctpass' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).token).toBe('mock.jwt.token');
    });

    it('возвращает 401 если пользователь не найден', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'ghost@example.com', password: 'anypass' },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toMatch(/Неверный email/);
    });

    it('возвращает 401 при неверном пароле', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user@example.com', password: 'wrongpass' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Профиль (защищённый маршрут) ────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('возвращает профиль при валидном токене', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Иван',
        has_paid: false,
        avatar: null,
        created_at: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer mock.jwt.token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).user.email).toBe('test@example.com');
    });

    it('возвращает 401 без Authorization заголовка', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
