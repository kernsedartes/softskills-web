import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(authMiddleware, adminMiddleware);

// GET /api/admin/stats
adminRouter.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const paidUsers = await prisma.user.count({ where: { has_paid: true } });
    const totalPayments = await prisma.payment.count({ where: { status: 'PAID' } });

    const skillAverages = await prisma.skillScore.groupBy({
      by: ['skill'],
      _avg: { score: true },
    });

    res.json({ totalUsers, paidUsers, totalPayments, skillAverages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, has_paid: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// POST /api/admin/exercises
adminRouter.post('/exercises', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, skill, difficulty, is_free } = req.body;
    const exercise = await prisma.exercise.create({
      data: { title, description, skill, difficulty: difficulty || 1, is_free: is_free ?? true },
    });
    res.status(201).json({ exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания упражнения' });
  }
});

// POST /api/admin/questions
adminRouter.post('/questions', async (req: AuthRequest, res: Response) => {
  try {
    const { text, skill, options, order } = req.body;
    const question = await prisma.question.create({
      data: { text, skill, options, order: order || 0 },
    });
    res.status(201).json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания вопроса' });
  }
});

// DELETE /api/admin/questions/:id
adminRouter.delete('/questions/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ message: 'Вопрос удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления вопроса' });
  }
});
