import { FastifyInstance } from 'fastify';
import { ExerciseStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authHook } from '../plugins/auth';

export async function programRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authHook);

  // GET /api/program
  fastify.get('/', async (request, reply) => {
    const program = await prisma.developmentProgram.findFirst({
      where: { user_id: request.userId },
      orderBy: { created_at: 'desc' },
      include: { exercises: { include: { exercise: true } } },
    });

    if (!program) {
      return reply.status(404).send({ error: 'Программа не найдена. Сначала пройдите тест.' });
    }
    return reply.send({ program });
  });

  // PATCH /api/program/exercise/:id/status
  fastify.patch<{ Params: { id: string } }>(
    '/exercise/:id/status',
    async (request, reply) => {
      const { id } = request.params;

      const pe = await prisma.programExercise.findFirst({
        where: { id, program: { user_id: request.userId } },
      });
      if (!pe) return reply.status(404).send({ error: 'Упражнение не найдено' });

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
          completed_at:
            newStatus === 'completed' ? now : newStatus === 'not_started' ? null : pe.completed_at,
        },
        include: { exercise: true },
      });

      return reply.send({ programExercise: updated });
    }
  );

  // PATCH /api/program/exercise/:id/notes
  fastify.patch<{ Params: { id: string }; Body: { notes: string } }>(
    '/exercise/:id/notes',
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body;

      const pe = await prisma.programExercise.findFirst({
        where: { id, program: { user_id: request.userId } },
      });
      if (!pe) return reply.status(404).send({ error: 'Упражнение не найдено' });

      const updated = await prisma.programExercise.update({
        where: { id },
        data: { notes },
        include: { exercise: true },
      });

      return reply.send({ programExercise: updated });
    }
  );
}
