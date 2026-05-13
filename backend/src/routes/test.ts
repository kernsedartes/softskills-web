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
        orderBy: { order: 'asc' },
        select: { id: true, text: true, skill: true, options: true, order: true },
      });

      // Take first `limit` questions per skill, then interleave across skills
      const countPerSkill: Record<string, number> = {};
      const bySkill: Record<string, typeof allQuestions> = {};
      for (const q of allQuestions) {
        countPerSkill[q.skill] = (countPerSkill[q.skill] ?? 0) + 1;
        if (countPerSkill[q.skill] <= limit) {
          if (!bySkill[q.skill]) bySkill[q.skill] = [];
          bySkill[q.skill].push(q);
        }
      }

      // Shuffle within each skill group, then interleave across skills
      const shuffle = <T>(arr: T[]): T[] => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      for (const skill of Object.keys(bySkill)) {
        bySkill[skill] = shuffle(bySkill[skill]);
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

      const allQuestions = await prisma.question.findMany({ orderBy: { order: 'asc' } });

      // Rebuild the same filtered set as /questions
      const countPerSkill: Record<string, number> = {};
      const variantQuestions = allQuestions.filter(q => {
        countPerSkill[q.skill] = (countPerSkill[q.skill] ?? 0) + 1;
        return countPerSkill[q.skill] <= questionsPerSkill;
      });

      if (!answers || answers.length !== variantQuestions.length) {
        return reply.status(400).send({
          error: `Необходимо ответить на все ${variantQuestions.length} вопросов`,
        });
      }

      const qMap = new Map(variantQuestions.map(q => [q.id, q]));

      for (const ans of answers) {
        const q = qMap.get(ans.questionId);
        if (!q) continue;
        await prisma.userAnswer.upsert({
          where: {
            user_id_question_id: { user_id: request.userId, question_id: ans.questionId },
          },
          update: { value: ans.value },
          create: { user_id: request.userId, question_id: ans.questionId, value: ans.value },
        });
      }

      // Count "passing" answers per skill (value >= 4 = "Часто" или "Всегда")
      // Gives clean scores: express 0/33/67/100, standard 0/20/40/60/80/100
      const rawTotals: Record<string, number> = {};
      for (const q of variantQuestions) {
        if (!(q.skill in rawTotals)) rawTotals[q.skill] = 0;
      }
      for (const ans of answers) {
        const q = qMap.get(ans.questionId);
        if (q) rawTotals[q.skill] += ans.value >= 4 ? 1 : 0;
      }

      const skillTotals: Record<string, number> = {};
      for (const [skill, raw] of Object.entries(rawTotals)) {
        skillTotals[skill] = Math.round((raw / questionsPerSkill) * 100);
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
