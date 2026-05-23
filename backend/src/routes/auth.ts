import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authHook } from '../plugins/auth';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/auth/register
  fastify.post<{ Body: { email: string; password: string; name?: string } }>(
    '/register',
    async (request, reply) => {
      const { email, password, name } = request.body;

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email и пароль обязательны' });
      }
      if (password.length < 6) {
        return reply.status(400).send({ error: 'Пароль минимум 6 символов' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'Пользователь с таким email уже существует' });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashed, name: name || null },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      reply.setCookie('token', token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 60 * 60 });
      return reply.status(201).send({
        user: { id: user.id, email: user.email, name: user.name, has_paid: user.has_paid },
      });
    }
  );

  // POST /api/auth/login
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ error: 'Неверный email или пароль' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return reply.status(401).send({ error: 'Неверный email или пароль' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      reply.setCookie('token', token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 60 * 60 });
      return reply.send({
        user: { id: user.id, email: user.email, name: user.name, has_paid: user.has_paid },
      });
    }
  );

  // POST /api/auth/logout
  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ ok: true });
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: authHook }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, email: true, name: true, has_paid: true, avatar: true, created_at: true },
    });
    if (!user) return reply.status(404).send({ error: 'Пользователь не найден' });
    return reply.send({ user });
  });

  // PATCH /api/auth/profile
  fastify.patch<{ Body: { name: string } }>(
    '/profile',
    { preHandler: authHook },
    async (request, reply) => {
      const { name } = request.body;
      const user = await prisma.user.update({
        where: { id: request.userId },
        data: { name: name?.trim() || null },
        select: { id: true, email: true, name: true, has_paid: true, created_at: true },
      });
      return reply.send({ user });
    }
  );

  // PATCH /api/auth/password
  fastify.patch<{ Body: { currentPassword: string; newPassword: string } }>(
    '/password',
    { preHandler: authHook },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ error: 'Заполните все поля' });
      }
      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'Новый пароль минимум 6 символов' });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user) return reply.status(404).send({ error: 'Пользователь не найден' });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return reply.status(400).send({ error: 'Неверный текущий пароль' });

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: request.userId }, data: { password: hashed } });

      return reply.send({ ok: true });
    }
  );

  // PATCH /api/auth/email
  fastify.patch<{ Body: { newEmail: string; password: string } }>(
    '/email',
    { preHandler: authHook },
    async (request, reply) => {
      const { newEmail, password } = request.body;

      if (!newEmail || !password) {
        return reply.status(400).send({ error: 'Заполните все поля' });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user) return reply.status(404).send({ error: 'Пользователь не найден' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return reply.status(400).send({ error: 'Неверный пароль' });

      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) return reply.status(409).send({ error: 'Email уже занят' });

      const updated = await prisma.user.update({
        where: { id: request.userId },
        data: { email: newEmail },
        select: { id: true, email: true, name: true, has_paid: true, avatar: true, created_at: true },
      });
      return reply.send({ user: updated });
    }
  );

  // GET /api/auth/stats
  fastify.get('/stats', { preHandler: authHook }, async (request, reply) => {
    const [program, scores] = await Promise.all([
      prisma.developmentProgram.findFirst({
        where: { user_id: request.userId },
        orderBy: { created_at: 'desc' },
        include: { exercises: true },
      }),
      prisma.skillScore.findMany({ where: { user_id: request.userId } }),
    ]);

    const total = program?.exercises.length ?? 0;
    const completed = program?.exercises.filter(e => e.status === 'completed').length ?? 0;
    const inProgress = program?.exercises.filter(e => e.status === 'in_progress').length ?? 0;

    return reply.send({
      exercisesTotal: total,
      exercisesCompleted: completed,
      exercisesInProgress: inProgress,
      testTaken: scores.length > 0,
      testDate: scores[0]?.created_at ?? null,
      programDate: program?.created_at ?? null,
    });
  });

  // POST /api/auth/avatar
  fastify.post('/avatar', { preHandler: authHook }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 2 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: 'Файл не загружен' });

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.mimetype)) {
      await data.toBuffer();
      return reply.status(400).send({ error: 'Допустимые форматы: jpg, png, webp' });
    }

    const ext = path.extname(data.filename) || '.jpg';
    const filename = `${request.userId}${ext}`;
    const dir = path.join(__dirname, '../../uploads/avatars');
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, filename), await data.toBuffer());

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: request.userId }, data: { avatar: avatarUrl } });

    return reply.send({ avatarUrl });
  });

  // DELETE /api/auth/avatar
  fastify.delete('/avatar', { preHandler: authHook }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (user?.avatar) {
      const filePath = path.join(__dirname, '../../', user.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.user.update({ where: { id: request.userId }, data: { avatar: null } });
    return reply.send({ ok: true });
  });
}
