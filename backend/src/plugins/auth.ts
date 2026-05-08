import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Не авторизован' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      email: string;
    };
    request.userId = payload.userId;
    request.userEmail = payload.email;
  } catch {
    return reply.status(401).send({ error: 'Токен недействителен' });
  }
}

export async function adminHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (!request.userEmail || !adminEmails.includes(request.userEmail)) {
    return reply.status(403).send({ error: 'Доступ запрещён' });
  }
}
