import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      email: string;
    };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const adminIds = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (!req.userEmail || !adminIds.includes(req.userEmail)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}
