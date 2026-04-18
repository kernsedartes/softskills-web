import { Router, Response } from 'express';
import { ExerciseStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const programRouter = Router();
programRouter.use(authMiddleware);

// GET /api/program
programRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const program = await prisma.developmentProgram.findFirst({
      where: { user_id: req.userId },
      orderBy: { created_at: 'desc' },
      include: {
        exercises: {
          include: { exercise: true },
        },
      },
    });

    if (!program) {
      res.status(404).json({ error: 'Программа не найдена. Сначала пройдите тест.' });
      return;
    }

    res.json({ program });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки программы' });
  }
});

// PATCH /api/program/exercise/:id/status  — cycle: not_started → in_progress → completed → not_started
programRouter.patch('/exercise/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const pe = await prisma.programExercise.findFirst({
      where: { id, program: { user_id: req.userId } },
    });

    if (!pe) {
      res.status(404).json({ error: 'Упражнение не найдено' });
      return;
    }

    const next: Record<ExerciseStatus, ExerciseStatus> = {
      not_started: 'in_progress',
      in_progress: 'completed',
      completed: 'not_started',
    };

    const newStatus = next[pe.status];
    const now = new Date();

    const updated = await prisma.programExercise.update({
      where: { id },
      data: {
        status: newStatus,
        started_at: newStatus === 'in_progress' ? now : pe.started_at,
        completed_at: newStatus === 'completed' ? now : newStatus === 'not_started' ? null : pe.completed_at,
      },
      include: { exercise: true },
    });

    res.json({ programExercise: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

// PATCH /api/program/exercise/:id/notes
programRouter.patch('/exercise/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body as { notes: string };

    const pe = await prisma.programExercise.findFirst({
      where: { id, program: { user_id: req.userId } },
    });

    if (!pe) {
      res.status(404).json({ error: 'Упражнение не найдено' });
      return;
    }

    const updated = await prisma.programExercise.update({
      where: { id },
      data: { notes },
      include: { exercise: true },
    });

    res.json({ programExercise: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения заметки' });
  }
});
