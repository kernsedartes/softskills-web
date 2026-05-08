import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authHook, adminHook } from '../plugins/auth';

export async function resourceRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/resources — public
  fastify.get<{ Querystring: { skill?: string; type?: string } }>(
    '/',
    async (request, reply) => {
      const { skill, type } = request.query;
      const resources = await prisma.resource.findMany({
        where: {
          ...(skill ? { skill: skill as any } : {}),
          ...(type ? { type: type as any } : {}),
        },
        orderBy: { created_at: 'desc' },
      });
      return reply.send({ resources });
    }
  );

  // All mutation routes require auth + admin
  fastify.register(async (adminScope) => {
    adminScope.addHook('preHandler', authHook);
    adminScope.addHook('preHandler', adminHook);

    // POST /api/resources
    adminScope.post<{ Body: { title: string; author: string; description: string; type: string; skill: string } }>(
      '/',
      async (request, reply) => {
        const { title, author, description, type, skill } = request.body;
        if (!title || !author || !description || !type || !skill) {
          return reply.status(400).send({ error: 'Заполните все поля' });
        }
        const resource = await prisma.resource.create({
          data: { title, author, description, type: type as any, skill: skill as any },
        });
        return reply.status(201).send({ resource });
      }
    );

    // PATCH /api/resources/:id
    adminScope.patch<{
      Params: { id: string };
      Body: { title?: string; author?: string; description?: string; type?: string; skill?: string };
    }>(
      '/:id',
      async (request, reply) => {
        const { title, author, description, type, skill } = request.body;
        const resource = await prisma.resource.update({
          where: { id: request.params.id },
          data: {
            ...(title ? { title } : {}),
            ...(author ? { author } : {}),
            ...(description ? { description } : {}),
            ...(type ? { type: type as any } : {}),
            ...(skill ? { skill: skill as any } : {}),
          },
        });
        return reply.send({ resource });
      }
    );

    // DELETE /api/resources/:id
    adminScope.delete<{ Params: { id: string } }>(
      '/:id',
      async (request, reply) => {
        const resource = await prisma.resource.findUnique({ where: { id: request.params.id } });
        if (resource?.file_url) {
          const filePath = path.join(__dirname, '../../', resource.file_url);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await prisma.resource.delete({ where: { id: request.params.id } });
        return reply.send({ ok: true });
      }
    );

    // POST /api/resources/:id/file
    adminScope.post<{ Params: { id: string } }>(
      '/:id/file',
      async (request, reply) => {
        const data = await request.file();
        if (!data) return reply.status(400).send({ error: 'Файл не загружен' });

        const old = await prisma.resource.findUnique({ where: { id: request.params.id } });
        if (old?.file_url) {
          const oldPath = path.join(__dirname, '../../', old.file_url);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const filename = unique + path.extname(data.filename);
        const dir = path.join(__dirname, '../../uploads/resources');
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(path.join(dir, filename), await data.toBuffer());

        const file_url = `/uploads/resources/${filename}`;
        const resource = await prisma.resource.update({
          where: { id: request.params.id },
          data: { file_url },
        });
        return reply.send({ resource });
      }
    );

    // DELETE /api/resources/:id/file
    adminScope.delete<{ Params: { id: string } }>(
      '/:id/file',
      async (request, reply) => {
        const resource = await prisma.resource.findUnique({ where: { id: request.params.id } });
        if (resource?.file_url) {
          const filePath = path.join(__dirname, '../../', resource.file_url);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        const updated = await prisma.resource.update({
          where: { id: request.params.id },
          data: { file_url: null },
        });
        return reply.send({ resource: updated });
      }
    );
  });
}
