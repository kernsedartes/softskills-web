import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads/resources')),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const resourcesRouter = Router();

// GET /api/resources — public
resourcesRouter.get('/', async (req, res: Response) => {
  try {
    const { skill, type } = req.query as { skill?: string; type?: string };
    const resources = await prisma.resource.findMany({
      where: {
        ...(skill ? { skill: skill as any } : {}),
        ...(type  ? { type:  type  as any } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ resources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки материалов' });
  }
});

// All mutation routes require admin
resourcesRouter.use(authMiddleware, adminMiddleware);

// POST /api/resources
resourcesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, author, description, type, skill } = req.body;
    if (!title || !author || !description || !type || !skill) {
      res.status(400).json({ error: 'Заполните все поля' });
      return;
    }
    const resource = await prisma.resource.create({
      data: { title, author, description, type, skill },
    });
    res.status(201).json({ resource });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания материала' });
  }
});

// PATCH /api/resources/:id
resourcesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, author, description, type, skill } = req.body;
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: {
        ...(title       ? { title }       : {}),
        ...(author      ? { author }      : {}),
        ...(description ? { description } : {}),
        ...(type        ? { type }        : {}),
        ...(skill       ? { skill }       : {}),
      },
    });
    res.json({ resource });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления материала' });
  }
});

// DELETE /api/resources/:id
resourcesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (resource?.file_url) {
      const filePath = path.join(__dirname, '../../', resource.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.resource.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления материала' });
  }
});

// POST /api/resources/:id/file — upload downloadable file
resourcesRouter.post('/:id/file', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Файл не загружен' }); return; }

    // Remove old file if exists
    const old = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (old?.file_url) {
      const oldPath = path.join(__dirname, '../../', old.file_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const file_url = `/uploads/resources/${req.file.filename}`;
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: { file_url },
    });
    res.json({ resource });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// DELETE /api/resources/:id/file — remove file
resourcesRouter.delete('/:id/file', async (req: AuthRequest, res: Response) => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (resource?.file_url) {
      const filePath = path.join(__dirname, '../../', resource.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: { file_url: null },
    });
    res.json({ resource: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});
