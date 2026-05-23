import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth';
import { testRoutes } from './routes/test';
import { programRoutes } from './routes/program';
import { paymentRoutes } from './routes/payment';
import { adminRoutes } from './routes/admin';
import { resourceRoutes } from './routes/resources';

dotenv.config();

const app = Fastify({ logger: true });

async function start(): Promise<void> {
  await app.register(cors, {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  });

  await app.register(cookie);

  await app.register(staticFiles, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads',
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(testRoutes, { prefix: '/api/test' });
  await app.register(programRoutes, { prefix: '/api/program' });
  await app.register(paymentRoutes, { prefix: '/api/payment' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(resourceRoutes, { prefix: '/api/resources' });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const PORT = Number(process.env.PORT) || 3001;
  await app.listen({ port: PORT, host: '0.0.0.0' });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
