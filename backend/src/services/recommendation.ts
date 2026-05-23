import { prisma } from '../lib/prisma';
import { Skill } from '@prisma/client';
import { sortBy } from 'lodash';

export async function generateProgram(
  userId: string,
  skillTotals: Record<string, number>,
  hasPaid: boolean
): Promise<void> {
  // sortBy from lodash guarantees stable sort regardless of JS engine
  const sorted = sortBy(Object.entries(skillTotals), ([, score]) => score);
  const targetSkills = sorted.slice(0, 3).map(([skill]) => skill as Skill);

  // Delete existing program for this user
  const existing = await prisma.developmentProgram.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
  if (existing) {
    await prisma.programExercise.deleteMany({ where: { program_id: existing.id } });
    await prisma.developmentProgram.delete({ where: { id: existing.id } });
  }

  // Create new program
  const program = await prisma.developmentProgram.create({
    data: { user_id: userId },
  });

  // Pick 2 exercises per target skill
  for (const skill of targetSkills) {
    const exercises = await prisma.exercise.findMany({
      where: {
        skill,
        ...(hasPaid ? {} : { is_free: true }),
      },
      orderBy: { difficulty: 'asc' },
      take: hasPaid ? 3 : 2,
    });

    for (const exercise of exercises) {
      await prisma.programExercise.create({
        data: { program_id: program.id, exercise_id: exercise.id },
      });
    }
  }
}
