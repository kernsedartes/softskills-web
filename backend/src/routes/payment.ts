import { Router, Response, Request } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateProgram } from '../services/recommendation';
import { v4 as uuidv4 } from 'uuid';

export const paymentRouter = Router();

const AMOUNT = 299;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const YOOKASSA_API = 'https://api.yookassa.ru/v3/payments';

function yookassaAuth() {
  return 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
}

async function createYookassaPayment(label: string, amount: number) {
  const body = {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    confirmation: {
      type: 'redirect',
      return_url: `${CLIENT_URL}/payment/success`,
    },
    capture: true,
    description: 'Расширенный доступ SoftSkills',
    metadata: { label },
  };

  const res = await fetch(YOOKASSA_API, {
    method: 'POST',
    headers: {
      Authorization: yookassaAuth(),
      'Content-Type': 'application/json',
      'Idempotence-Key': uuidv4(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YooKassa error ${res.status}: ${err}`);
  }

  return res.json() as Promise<{
    id: string;
    status: string;
    confirmation: { confirmation_url: string };
  }>;
}

// POST /api/payment/create
paymentRouter.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const label = `SS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const yk = await createYookassaPayment(label, AMOUNT);

    await prisma.payment.create({
      data: {
        user_id: req.userId!,
        amount: AMOUNT,
        label,
        yookassa_id: yk.id,
        status: 'PENDING',
      },
    });

    res.json({ paymentUrl: yk.confirmation.confirmation_url, label });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания платежа' });
  }
});

// POST /api/payment/webhook  — вызывается ЮКассой при изменении статуса
paymentRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, object } = req.body as {
      event: string;
      object: { id: string; status: string; metadata?: { label?: string } };
    };

    if (event === 'payment.succeeded' && object.status === 'succeeded') {
      const yookassaId = object.id;
      const label = object.metadata?.label;

      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(yookassaId ? [{ yookassa_id: yookassaId }] : []),
            ...(label ? [{ label }] : []),
          ],
          status: 'PENDING',
        },
      });

      if (payment) {
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
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// GET /api/payment/status/:label
paymentRouter.get('/status/:label', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { label: req.params.label, user_id: req.userId },
    });
    if (!payment) {
      res.status(404).json({ error: 'Платёж не найден' });
      return;
    }

    // If still pending and we have a YooKassa id — poll the API directly (no webhook needed)
    if (payment.status === 'PENDING' && payment.yookassa_id) {
      const ykRes = await fetch(`${YOOKASSA_API}/${payment.yookassa_id}`, {
        headers: { Authorization: yookassaAuth() },
      });
      if (ykRes.ok) {
        const ykPayment = await ykRes.json() as { status: string };
        if (ykPayment.status === 'succeeded') {
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
          res.json({ payment: updated });
          return;
        } else if (ykPayment.status === 'canceled') {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });
        }
      }
    }

    res.json({ payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка проверки платежа' });
  }
});
