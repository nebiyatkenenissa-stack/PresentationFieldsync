import type { Response } from 'express';

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function sendMessage(res: Response, message: string, status = 200): void {
  res.status(status).json({ message });
}
