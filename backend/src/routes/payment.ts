import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authHook } from '../plugins/auth';
import { generateProgram } from '../services/recommendation';

const AMOUNT = 299;
const YOOKASSA_API = 'https://api.yookassa.ru/v3';

function getYookassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY не заданы в .env');
  return { username: shopId, password: secretKey };
}

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/payment/create — создание платежа в ЮKassa, возвращает confirmation_token для виджета
  fastify.post(
    '/create',
    { preHandler: authHook },
    async (request, reply) => {
      const label = `SS${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      const idempotenceKey = uuidv4();
      const returnUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/success`;

      const auth = getYookassaAuth();

      const { data } = await axios.post(
        `${YOOKASSA_API}/payments`,
        {
          amount: { value: `${AMOUNT}.00`, currency: 'RUB' },
          confirmation: { type: 'embedded' },
          capture: true,
          description: 'Расширенный доступ — SoftSkills Platform',
          metadata: { label, user_id: request.userId },
          return_url: returnUrl,
        },
        {
          auth,
          headers: { 'Idempotence-Key': idempotenceKey },
        }
      );

      await prisma.payment.create({
        data: {
          user_id: request.userId,
          amount: AMOUNT,
          label,
          yookassa_id: data.id,
          status: 'PENDING',
        },
      });

      return reply.send({
        confirmationToken: data.confirmation.confirmation_token,
        label,
      });
    }
  );

  // POST /api/payment/webhook — вебхук от ЮKassa
  fastify.post('/webhook', async (request, reply) => {
    const body = request.body as {
      type: string;
      object?: { id: string; status: string; metadata?: { label?: string } };
    };

    if (body.type !== 'notification' || !body.object) {
      return reply.send({ ok: true });
    }

    const yookassaId = body.object.id;

    // Перепроверяем статус напрямую в ЮKassa (защита от подделки вебхука)
    let paymentData: { status: string; metadata?: { label?: string } };
    try {
      const auth = getYookassaAuth();
      const { data } = await axios.get(`${YOOKASSA_API}/payments/${yookassaId}`, { auth });
      paymentData = data;
    } catch {
      return reply.status(200).send({ ok: true });
    }

    if (paymentData.status === 'canceled') {
      const label = paymentData.metadata?.label;
      if (label) {
        const payment = await prisma.payment.findFirst({ where: { label } });
        if (payment && payment.status === 'PENDING') {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        }
      }
      return reply.send({ ok: true });
    }

    if (paymentData.status !== 'succeeded') {
      return reply.send({ ok: true });
    }

    const label = paymentData.metadata?.label;
    if (!label) return reply.send({ ok: true });

    const payment = await prisma.payment.findFirst({ where: { label } });
    if (!payment || payment.status === 'PAID') return reply.send({ ok: true });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paid_at: new Date() },
    });

    await prisma.user.update({
      where: { id: payment.user_id },
      data: { has_paid: true },
    });

    const scores = await prisma.skillScore.findMany({ where: { user_id: payment.user_id } });
    if (scores.length) {
      const skillTotals: Record<string, number> = {};
      for (const s of scores) skillTotals[s.skill] = s.score;
      await generateProgram(payment.user_id, skillTotals, true);
    }

    return reply.send({ ok: true });
  });

  // POST /api/payment/mock-confirm — подтверждение платежа в демо-режиме
  fastify.post<{ Body: { label: string } }>(
    '/mock-confirm',
    { preHandler: authHook },
    async (request, reply) => {
      const { label } = request.body;
      if (!label) return reply.status(400).send({ error: 'label обязателен' });

      const payment = await prisma.payment.findFirst({
        where: { label, user_id: request.userId },
      });
      if (!payment) return reply.status(404).send({ error: 'Платёж не найден' });
      if (payment.status !== 'PENDING') return reply.status(400).send({ error: 'Платёж уже обработан' });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paid_at: new Date() },
      });
      await prisma.user.update({
        where: { id: payment.user_id },
        data: { has_paid: true },
      });

      const scores = await prisma.skillScore.findMany({ where: { user_id: payment.user_id } });
      if (scores.length) {
        const skillTotals: Record<string, number> = {};
        for (const s of scores) skillTotals[s.skill] = s.score;
        await generateProgram(payment.user_id, skillTotals, true);
      }

      return reply.send({ ok: true });
    }
  );

  // GET /api/payment/status/:label — проверка статуса
  fastify.get<{ Params: { label: string } }>(
    '/status/:label',
    { preHandler: authHook },
    async (request, reply) => {
      const { label } = request.params;
      const payment = await prisma.payment.findFirst({
        where: { label, user_id: request.userId },
      });

      if (!payment) return reply.status(404).send({ error: 'Платёж не найден' });

      // Если ещё PENDING — спрашиваем ЮKassa напрямую
      if (payment.status === 'PENDING' && payment.yookassa_id) {
        try {
          const auth = getYookassaAuth();
          const { data } = await axios.get(`${YOOKASSA_API}/payments/${payment.yookassa_id}`, { auth });

          if (data.status === 'succeeded') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'PAID', paid_at: new Date() },
            });
            await prisma.user.update({
              where: { id: payment.user_id },
              data: { has_paid: true },
            });

            const scores = await prisma.skillScore.findMany({ where: { user_id: payment.user_id } });
            if (scores.length) {
              const skillTotals: Record<string, number> = {};
              for (const s of scores) skillTotals[s.skill] = s.score;
              await generateProgram(payment.user_id, skillTotals, true);
            }

            const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
            return reply.send({ payment: updated });
          }

          if (data.status === 'canceled') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' },
            });
            const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
            return reply.send({ payment: updated });
          }
        } catch {
          // оставляем текущий статус из БД
        }
      }

      return reply.send({ payment });
    }
  );
}
