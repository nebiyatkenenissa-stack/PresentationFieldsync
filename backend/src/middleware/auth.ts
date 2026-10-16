import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token.js';

export const ROLES = ['admin', 'manager', 'supervisor', 'field_officer'] as const;
export type Role = (typeof ROLES)[number];

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as any).user = payload;
  next();
}

// The role lives in the signed JWT payload, so no extra lookup is needed. This is
// always mounted *after* requireAuth -- on its own it would read an empty payload
// and reject everyone. Role changes only take effect on the next sign-in because
// the token is minted at login, which is why the client re-authenticates after a
// role change (or the old token keeps its previous role until it expires).
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).user?.role;
    if (!role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Forbidden: requires role ' + allowed.join(' or ') });
      return;
    }
    next();
  };
}