// Интеграционные тесты для роутов оплаты
// Fastify.inject() — реальные HTTP без сети, Prisma и axios замоканы

import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { paymentRoutes } from '../routes/payment';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { update: jest.fn() },
    skillScore: { findMany: jest.fn() },
  },
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../services/recommendation', () => ({
  generateProgram: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', email: 'test@example.com' }),
}));

import axios from 'axios';
import { generateProgram } from '../services/recommendation';

describe('Payment routes', () => {
  let app: FastifyInstance;
  const authHeader = { cookie: 'token=mock.jwt.token' };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.YOOKASSA_SHOP_ID = 'shop-123';
    process.env.YOOKASSA_SECRET_KEY = 'secret-key';
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(paymentRoutes, { prefix: '/api/payment' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/payment/mock-confirm ────────────────────────────────────────

  describe('POST /api/payment/mock-confirm', () => {
    it('подтверждает платёж и выдаёт доступ пользователю', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/mock-confirm',
        headers: authHeader,
        payload: { label: 'SS123' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { has_paid: true } })
      );
    });

    it('вызывает generateProgram если у пользователя есть результаты теста', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([
        { skill: 'communication', score: 60 },
        { skill: 'leadership', score: 40 },
      ]);

      await app.inject({
        method: 'POST',
        url: '/api/payment/mock-confirm',
        headers: authHeader,
        payload: { label: 'SS123' },
      });

      expect(generateProgram).toHaveBeenCalledWith(
        'user-123',
        { communication: 60, leadership: 40 },
        true
      );
    });

    it('возвращает 404 если платёж не найден', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/mock-confirm',
        headers: authHeader,
        payload: { label: 'NOTEXIST' },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toMatch(/не найден/);
    });

    it('возвращает 400 если платёж уже обработан', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PAID',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/mock-confirm',
        headers: authHeader,
        payload: { label: 'SS123' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/уже обработан/);
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/mock-confirm',
        payload: { label: 'SS123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/payment/status/:label ───────────────────────────────────────

  describe('GET /api/payment/status/:label', () => {
    it('возвращает статус PAID из БД без запроса в ЮKassa', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PAID', yookassa_id: null,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/status/SS123',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).payment.status).toBe('PAID');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('при статусе PENDING спрашивает ЮKassa и обновляет до PAID', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING', yookassa_id: 'yk-id',
      });
      (axios.get as jest.Mock).mockResolvedValue({ data: { status: 'succeeded' } });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PAID',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/status/SS123',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).payment.status).toBe('PAID');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
      );
    });

    it('при статусе PENDING и canceled от ЮKassa выставляет FAILED', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING', yookassa_id: 'yk-id',
      });
      (axios.get as jest.Mock).mockResolvedValue({ data: { status: 'canceled' } });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'FAILED',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/status/SS123',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).payment.status).toBe('FAILED');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } })
      );
    });

    it('возвращает 404 если платёж не найден или принадлежит другому пользователю', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/status/UNKNOWN',
        headers: authHeader,
      });

      expect(res.statusCode).toBe(404);
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/payment/status/SS123' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /api/payment/create ──────────────────────────────────────────────

  describe('POST /api/payment/create', () => {
    it('создаёт платёж в ЮKassa и возвращает confirmationToken', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'yk-payment-id',
          confirmation: { confirmation_token: 'ct_test_token' },
        },
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/create',
        headers: authHeader,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.confirmationToken).toBe('ct_test_token');
      expect(typeof body.label).toBe('string');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', amount: 299 }) })
      );
    });

    it('возвращает 401 без cookie', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/payment/create', payload: {} });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /api/payment/webhook ─────────────────────────────────────────────

  describe('POST /api/payment/webhook', () => {
    it('при succeeded обновляет статус до PAID и выдаёт доступ', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { status: 'succeeded', metadata: { label: 'SS123' } },
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.skillScore.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        payload: { type: 'notification', object: { id: 'yk-id', status: 'succeeded' } },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { has_paid: true } })
      );
    });

    it('при canceled выставляет FAILED', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { status: 'canceled', metadata: { label: 'SS123' } },
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PENDING',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        payload: { type: 'notification', object: { id: 'yk-id', status: 'canceled' } },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } })
      );
    });

    it('игнорирует вебхук неизвестного типа', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        payload: { type: 'other_event' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('не обновляет уже оплаченный платёж', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { status: 'succeeded', metadata: { label: 'SS123' } },
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-1', label: 'SS123', user_id: 'user-123', status: 'PAID',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        payload: { type: 'notification', object: { id: 'yk-id', status: 'succeeded' } },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});
