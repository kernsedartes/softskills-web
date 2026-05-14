// Unit-тесты для рекомендательной системы (src/services/recommendation.ts)
// Проверяет: выбор слабых навыков, is_free фильтр, удаление старой программы

import { generateProgram } from '../services/recommendation';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    developmentProgram: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    programExercise: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    exercise: {
      findMany: jest.fn(),
    },
  },
}));

const mockExercises = [{ id: 'ex-1' }, { id: 'ex-2' }, { id: 'ex-3' }];

describe('generateProgram', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.developmentProgram.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.developmentProgram.create as jest.Mock).mockResolvedValue({ id: 'prog-new' });
    (prisma.programExercise.create as jest.Mock).mockResolvedValue({});
    (prisma.exercise.findMany as jest.Mock).mockResolvedValue(mockExercises);
  });

  it('создаёт программу именно для 3 слабых навыков', async () => {
    const scores = {
      communication: 80,
      leadership: 20,        // слабый
      self_organization: 40, // слабый
      empathy: 60,
      critical_thinking: 10, // слабый
    };

    await generateProgram('user-1', scores, false);

    expect(prisma.exercise.findMany).toHaveBeenCalledTimes(3);

    const skills = (prisma.exercise.findMany as jest.Mock).mock.calls.map(
      (call: any[]) => call[0].where.skill
    );
    expect(skills).toContain('critical_thinking');
    expect(skills).toContain('leadership');
    expect(skills).toContain('self_organization');
    expect(skills).not.toContain('communication');
    expect(skills).not.toContain('empathy');
  });

  it('для бесплатного пользователя фильтрует только is_free упражнения', async () => {
    const scores = {
      communication: 10,
      leadership: 20,
      self_organization: 30,
      empathy: 80,
      critical_thinking: 90,
    };

    await generateProgram('user-1', scores, false);

    const calls = (prisma.exercise.findMany as jest.Mock).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[0].where.is_free).toBe(true);
    });
  });

  it('для платного пользователя не ограничивает is_free', async () => {
    const scores = {
      communication: 10,
      leadership: 20,
      self_organization: 30,
      empathy: 80,
      critical_thinking: 90,
    };

    await generateProgram('user-1', scores, true);

    const calls = (prisma.exercise.findMany as jest.Mock).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[0].where.is_free).toBeUndefined();
    });
  });

  it('платный пользователь получает 3 упражнения на навык (take: 3)', async () => {
    const scores = {
      communication: 10,
      leadership: 20,
      self_organization: 30,
      empathy: 80,
      critical_thinking: 90,
    };

    await generateProgram('user-1', scores, true);

    const calls = (prisma.exercise.findMany as jest.Mock).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[0].take).toBe(3);
    });
  });

  it('бесплатный пользователь получает 2 упражнения на навык (take: 2)', async () => {
    const scores = {
      communication: 10,
      leadership: 20,
      self_organization: 30,
      empathy: 80,
      critical_thinking: 90,
    };

    await generateProgram('user-1', scores, false);

    const calls = (prisma.exercise.findMany as jest.Mock).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[0].take).toBe(2);
    });
  });

  it('удаляет предыдущую программу перед созданием новой', async () => {
    (prisma.developmentProgram.findFirst as jest.Mock).mockResolvedValue({ id: 'old-prog' });
    (prisma.programExercise.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.developmentProgram.delete as jest.Mock).mockResolvedValue({});

    const scores = {
      communication: 10, leadership: 20, self_organization: 30,
      empathy: 40, critical_thinking: 50,
    };

    await generateProgram('user-1', scores, false);

    expect(prisma.programExercise.deleteMany).toHaveBeenCalledWith({ where: { program_id: 'old-prog' } });
    expect(prisma.developmentProgram.delete).toHaveBeenCalledWith({ where: { id: 'old-prog' } });
  });

  it('если предыдущей программы нет — не пытается удалять', async () => {
    (prisma.developmentProgram.findFirst as jest.Mock).mockResolvedValue(null);

    const scores = { communication: 10, leadership: 20, self_organization: 30, empathy: 40, critical_thinking: 50 };
    await generateProgram('user-1', scores, false);

    expect(prisma.programExercise.deleteMany).not.toHaveBeenCalled();
    expect(prisma.developmentProgram.delete).not.toHaveBeenCalled();
  });
});
