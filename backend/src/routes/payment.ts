import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateProgram } from '../services/recommendation';

export const paymentRouter = Router();

const AMOUNT = 299;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// POST /api/payment/create
paymentRouter.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const label = `SS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await prisma.payment.create({
      data: {
        user_id: req.userId!,
        amount: AMOUNT,
        label,
        status: 'PENDING',
      },
    });

    const paymentUrl = `${CLIENT_URL}/payment/mock?label=${label}`;
    res.json({ paymentUrl, label });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания платежа' });
  }
});

// POST /api/payment/mock-confirm  — симулирует подтверждение оплаты
paymentRouter.post('/mock-confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { label } = req.body;

    const payment = await prisma.payment.findFirst({
      where: { label, user_id: req.userId!, status: 'PENDING' },
    });

    if (!payment) {
      res.status(404).json({ error: 'Платёж не найден' });
      return;
    }

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

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка подтверждения платежа' });
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
    res.json({ payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка проверки платежа' });
  }
});
