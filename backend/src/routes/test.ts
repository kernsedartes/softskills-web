import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authHook } from '../plugins/auth';
import { generateProgram } from '../services/recommendation';

type Variant = 'express' | 'standard' | 'extended';

const QUESTIONS_PER_SKILL: Record<Variant, number> = {
  express: 3,
  standard: 5,
  extended: 10,
};

export async function testRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authHook);

  // GET /api/test/questions?variant=express|standard
  fastify.get<{ Querystring: { variant?: string } }>(
    '/questions',
    async (request, reply) => {
      const variantParam = request.query.variant;
      const variant: Variant =
        variantParam === 'express' ? 'express'
        : variantParam === 'extended' ? 'extended'
        : 'standard';
      const limit = QUESTIONS_PER_SKILL[variant];

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      const hasScores = await prisma.skillScore.count({ where: { user_id: request.userId } });

      if (hasScores > 0 && !user?.has_paid) {
        return reply.status(403).send({ error: 'retake_locked' });
      }

      const allQuestions = await prisma.question.findMany({
        select: { id: true, text: true, skill: true, options: true, order: true },
      });

      const shuffle = <T>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      // Group by skill, shuffle the full pool, then pick `limit` random questions per skill
      const bySkill: Record<string, typeof allQuestions> = {};
      for (const q of allQuestions) {
        if (!bySkill[q.skill]) bySkill[q.skill] = [];
        bySkill[q.skill].push(q);
      }
      for (const skill of Object.keys(bySkill)) {
        bySkill[skill] = shuffle(bySkill[skill]).slice(0, limit);
      }

      const skillKeys = shuffle(Object.keys(bySkill));
      const questions: typeof allQuestions = [];
      for (let i = 0; i < limit; i++) {
        for (const skill of skillKeys) {
          if (bySkill[skill][i]) questions.push(bySkill[skill][i]);
        }
      }

      return reply.send({ questions, variant, questionsPerSkill: limit });
    }
  );

  // GET /api/test/history
  fastify.get('/history', async (request, reply) => {
    const history = await prisma.skillScoreHistory.findMany({
      where: { user_id: request.userId },
      orderBy: [{ attempt: 'asc' }, { created_at: 'asc' }],
    });
    return reply.send({ history });
  });

  // GET /api/test/results
  fastify.get('/results', async (request, reply) => {
    const scores = await prisma.skillScore.findMany({
      where: { user_id: request.userId },
      orderBy: { score: 'desc' },
    });
    if (!scores.length) {
      return reply.status(404).send({ error: 'Тест ещё не пройден' });
    }
    return reply.send({ scores });
  });

  // POST /api/test/submit
  fastify.post<{
    Body: {
      answers: { questionId: string; value: number }[];
      variant?: string;
    };
  }>(
    '/submit',
    async (request, reply) => {
      const { answers, variant: rawVariant } = request.body;
      const variant: Variant =
        rawVariant === 'express' ? 'express'
        : rawVariant === 'extended' ? 'extended'
        : 'standard';
      const questionsPerSkill = QUESTIONS_PER_SKILL[variant];

      const allQuestions = await prisma.question.findMany();
      const qMap = new Map(allQuestions.map(q => [q.id, q]));

      const expectedCount = questionsPerSkill * 5;
      if (!answers || answers.length !== expectedCount) {
        return reply.status(400).send({
          error: `Необходимо ответить на все ${expectedCount} вопросов`,
        });
      }

      for (const ans of answers) {
        if (!qMap.has(ans.questionId)) continue;
        await prisma.userAnswer.upsert({
          where: {
            user_id_question_id: { user_id: request.userId, question_id: ans.questionId },
          },
          update: { value: ans.value },
          create: { user_id: request.userId, question_id: ans.questionId, value: ans.value },
        });
      }

      // Score: count passing answers (>= 4) per skill from the submitted set
      const passingPerSkill: Record<string, number> = {};
      for (const ans of answers) {
        const q = qMap.get(ans.questionId);
        if (!q) continue;
        if (!(q.skill in passingPerSkill)) passingPerSkill[q.skill] = 0;
        if (ans.value >= 4) passingPerSkill[q.skill]++;
      }

      const skillTotals: Record<string, number> = {};
      for (const [skill, passing] of Object.entries(passingPerSkill)) {
        skillTotals[skill] = Math.round((passing / questionsPerSkill) * 100);
      }

      for (const [skill, score] of Object.entries(skillTotals)) {
        await prisma.skillScore.upsert({
          where: { user_id_skill: { user_id: request.userId, skill: skill as any } },
          update: { score },
          create: { user_id: request.userId, skill: skill as any, score },
        });
      }

      const attemptCount = await prisma.skillScoreHistory.count({
        where: { user_id: request.userId },
      });
      const attempt = Math.floor(attemptCount / Object.keys(skillTotals).length) + 1;
      for (const [skill, score] of Object.entries(skillTotals)) {
        await prisma.skillScoreHistory.create({
          data: { user_id: request.userId, skill: skill as any, score, attempt },
        });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      await generateProgram(request.userId, skillTotals, user?.has_paid || false);

      const scores = await prisma.skillScore.findMany({ where: { user_id: request.userId } });
      return reply.send({ scores, message: 'Тест успешно завершён' });
    }
  );
}
