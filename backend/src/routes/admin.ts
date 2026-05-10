import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authHook, adminHook } from '../plugins/auth';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authHook);
  fastify.addHook('preHandler', adminHook);

  // GET /api/admin/stats
  fastify.get('/stats', async (_request, reply) => {
    const totalUsers = await prisma.user.count();
    const paidUsers = await prisma.user.count({ where: { has_paid: true } });
    const totalPayments = await prisma.payment.count({ where: { status: 'PAID' } });

    const skillAverages = await prisma.skillScore.groupBy({
      by: ['skill'],
      _avg: { score: true },
    });

    return reply.send({ totalUsers, paidUsers, totalPayments, skillAverages });
  });

  // GET /api/admin/users
  fastify.get('/users', async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, has_paid: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ users });
  });

  // PATCH /api/admin/users/:id
  fastify.patch<{ Params: { id: string }; Body: { has_paid: boolean } }>(
    '/users/:id',
    async (request, reply) => {
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: { has_paid: request.body.has_paid },
        select: { id: true, email: true, name: true, has_paid: true, created_at: true },
      });
      return reply.send({ user });
    }
  );

  // GET /api/admin/users/:id/scores
  fastify.get<{ Params: { id: string } }>(
    '/users/:id/scores',
    async (request, reply) => {
      const scores = await prisma.skillScore.findMany({
        where: { user_id: request.params.id },
        orderBy: { score: 'desc' },
      });
      return reply.send({ scores });
    }
  );

  // GET /api/admin/questions
  fastify.get('/questions', async (_request, reply) => {
    const questions = await prisma.question.findMany({
      orderBy: [{ skill: 'asc' }, { order: 'asc' }],
    });
    return reply.send({ questions });
  });

  // POST /api/admin/exercises
  fastify.post<{ Body: { title: string; description: string; skill: string; difficulty?: number; is_free?: boolean } }>(
    '/exercises',
    async (request, reply) => {
      const { title, description, skill, difficulty, is_free } = request.body;
      const exercise = await prisma.exercise.create({
        data: { title, description, skill: skill as any, difficulty: difficulty || 1, is_free: is_free ?? true },
      });
      return reply.status(201).send({ exercise });
    }
  );

  // POST /api/admin/questions
  fastify.post<{ Body: { text: string; skill: string; options: string[]; order?: number } }>(
    '/questions',
    async (request, reply) => {
      const { text, skill, options, order } = request.body;
      const question = await prisma.question.create({
        data: { text, skill: skill as any, options, order: order || 0 },
      });
      return reply.status(201).send({ question });
    }
  );

  // DELETE /api/admin/questions/:id
  fastify.delete<{ Params: { id: string } }>(
    '/questions/:id',
    async (request, reply) => {
      await prisma.question.delete({ where: { id: request.params.id } });
      return reply.send({ message: 'Вопрос удалён' });
    }
  );
}
