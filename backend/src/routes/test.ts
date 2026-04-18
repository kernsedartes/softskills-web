import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateProgram } from '../services/recommendation';

export const testRouter = Router();
testRouter.use(authMiddleware);

// GET /api/test/questions
testRouter.get('/questions', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const hasScores = await prisma.skillScore.count({ where: { user_id: req.userId } });

    if (hasScores > 0 && !user?.has_paid) {
      res.status(403).json({ error: 'retake_locked' });
      return;
    }

    const questions = await prisma.question.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, text: true, skill: true, options: true, order: true },
    });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки вопросов' });
  }
});

// GET /api/test/history
testRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const history = await prisma.skillScoreHistory.findMany({
      where: { user_id: req.userId },
      orderBy: [{ attempt: 'asc' }, { created_at: 'asc' }],
    });
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});

// GET /api/test/results
testRouter.get('/results', async (req: AuthRequest, res: Response) => {
  try {
    const scores = await prisma.skillScore.findMany({
      where: { user_id: req.userId },
      orderBy: { score: 'desc' },
    });
    if (!scores.length) {
      res.status(404).json({ error: 'Тест ещё не пройден' });
      return;
    }
    res.json({ scores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения результатов' });
  }
});

// POST /api/test/submit
// Body: { answers: [{ questionId: string, value: number }] }
testRouter.post('/submit', async (req: AuthRequest, res: Response) => {
  try {
    const { answers } = req.body as {
      answers: { questionId: string; value: number }[];
    };

    if (!answers || answers.length !== 25) {
      res.status(400).json({ error: 'Необходимо ответить на все 25 вопросов' });
      return;
    }

    // Load questions to know skill mapping
    const questions = await prisma.question.findMany();
    const qMap = new Map(questions.map(q => [q.id, q]));

    // Upsert answers
    for (const ans of answers) {
      const q = qMap.get(ans.questionId);
      if (!q) continue;
      await prisma.userAnswer.upsert({
        where: {
          user_id_question_id: { user_id: req.userId!, question_id: ans.questionId },
        },
        update: { value: ans.value },
        create: { user_id: req.userId!, question_id: ans.questionId, value: ans.value },
      });
    }

    // Calculate scores per skill
    const skillTotals: Record<string, number> = {
      communication: 0,
      leadership: 0,
      self_organization: 0,
      empathy: 0,
      critical_thinking: 0,
    };

    for (const ans of answers) {
      const q = qMap.get(ans.questionId);
      if (q) skillTotals[q.skill] += ans.value;
    }

    // Upsert skill scores
    for (const [skill, score] of Object.entries(skillTotals)) {
      await prisma.skillScore.upsert({
        where: { user_id_skill: { user_id: req.userId!, skill: skill as any } },
        update: { score },
        create: { user_id: req.userId!, skill: skill as any, score },
      });
    }

    // Save history snapshot
    const attemptCount = await prisma.skillScoreHistory.count({ where: { user_id: req.userId } });
    const attempt = Math.floor(attemptCount / 5) + 1;
    for (const [skill, score] of Object.entries(skillTotals)) {
      await prisma.skillScoreHistory.create({
        data: { user_id: req.userId!, skill: skill as any, score, attempt },
      });
    }

    // Generate program
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    await generateProgram(req.userId!, skillTotals, user?.has_paid || false);

    const scores = await prisma.skillScore.findMany({ where: { user_id: req.userId } });
    res.json({ scores, message: 'Тест успешно завершён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результатов' });
  }
});
