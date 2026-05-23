// Интеграционные тесты для роутов аутентификации
// Используют Fastify.inject() — реальные HTTP без сети, Prisma замокирован

import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
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
    await app.register(cookie);
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
      expect(body.user.email).toBe('new@example.com');
      expect(res.headers['set-cookie']).toMatch(/token=/);
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
      expect(res.headers['set-cookie']).toMatch(/token=/);
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
        headers: { cookie: 'token=mock.jwt.token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).user.email).toBe('test@example.com');
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Смена имени ──────────────────────────────────────────────────────────────

  describe('PATCH /api/auth/profile', () => {
    it('обновляет имя пользователя', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Новое Имя',
        has_paid: false,
        created_at: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { name: 'Новое Имя' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).user.name).toBe('Новое Имя');
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        payload: { name: 'test' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Смена пароля ─────────────────────────────────────────────────────────────

  describe('PATCH /api/auth/password', () => {
    const existingUser = {
      id: 'user-123',
      email: 'test@example.com',
      password: '$2a$10$mockhash',
    };

    it('успешно меняет пароль при верном текущем пароле', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/password',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { currentPassword: 'oldpass123', newPassword: 'newpass123' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
    });

    it('возвращает 400 при неверном текущем пароле', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/password',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { currentPassword: 'wrongpass', newPassword: 'newpass123' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/неверный/i);
    });

    it('возвращает 400 если новый пароль короче 6 символов', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/password',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { currentPassword: 'oldpass', newPassword: '123' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/6 символов/);
    });

    it('возвращает 400 если поля не переданы', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/password',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Смена email ──────────────────────────────────────────────────────────────

  describe('PATCH /api/auth/email', () => {
    const existingUser = {
      id: 'user-123',
      email: 'old@example.com',
      password: '$2a$10$mockhash',
    };

    it('успешно меняет email', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser)  // find current user
        .mockResolvedValueOnce(null);          // check new email free
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'new@example.com',
        avatar: null,
        created_at: new Date().toISOString(),
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/email',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { newEmail: 'new@example.com', password: 'correctpass' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).user.email).toBe('new@example.com');
    });

    it('возвращает 409 если новый email уже занят', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ id: 'other-user' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/email',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { newEmail: 'taken@example.com', password: 'correctpass' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('возвращает 400 при неверном пароле', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/email',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: { newEmail: 'new@example.com', password: 'wrongpass' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('возвращает 400 если поля не переданы', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/email',
        headers: { cookie: 'token=mock.jwt.token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
