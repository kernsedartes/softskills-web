import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (err: Error | null, dest: string) => void) =>
    cb(null, path.join(__dirname, '../../uploads/avatars')),
  filename: (req: Express.Request, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
    const ext = path.extname(file.originalname);
    cb(null, `${(req as AuthRequest).userId}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email и пароль обязательны' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль минимум 6 символов' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || null },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, has_paid: user.has_paid },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, has_paid: user.has_paid },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PATCH /api/auth/profile
authRouter.patch('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name?.trim() || null },
      select: { id: true, email: true, name: true, has_paid: true, created_at: true },
    });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// PATCH /api/auth/password
authRouter.patch('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Заполните все поля' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) { res.status(400).json({ error: 'Неверный текущий пароль' }); return; }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

// GET /api/auth/stats
authRouter.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [program, scores] = await Promise.all([
      prisma.developmentProgram.findFirst({
        where: { user_id: req.userId },
        orderBy: { created_at: 'desc' },
        include: { exercises: true },
      }),
      prisma.skillScore.findMany({ where: { user_id: req.userId } }),
    ]);

    const total = program?.exercises.length ?? 0;
    const completed = program?.exercises.filter(e => e.status === 'completed').length ?? 0;
    const inProgress = program?.exercises.filter(e => e.status === 'in_progress').length ?? 0;

    res.json({
      exercisesTotal: total,
      exercisesCompleted: completed,
      exercisesInProgress: inProgress,
      testTaken: scores.length > 0,
      testDate: scores[0]?.created_at ?? null,
      programDate: program?.created_at ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

// PATCH /api/auth/email
authRouter.patch('/email', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { newEmail, password } = req.body as { newEmail: string; password: string };

    if (!newEmail || !password) {
      res.status(400).json({ error: 'Заполните все поля' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(400).json({ error: 'Неверный пароль' }); return; }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) { res.status(409).json({ error: 'Email уже занят' }); return; }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { email: newEmail },
      select: { id: true, email: true, name: true, has_paid: true, avatar: true, created_at: true },
    });
    res.json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены email' });
  }
});

// POST /api/auth/avatar
authRouter.post('/avatar', authMiddleware, upload.single('avatar'), async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.userId },
      data: { avatar: avatarUrl },
    });

    res.json({ avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

// DELETE /api/auth/avatar
authRouter.delete('/avatar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user?.avatar) {
      const filePath = path.join(__dirname, '../../', user.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.user.update({ where: { id: req.userId }, data: { avatar: null } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления аватара' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, has_paid: true, avatar: true, created_at: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
