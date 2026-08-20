import { Request, Response } from 'express';
import { pool } from '../config/db.js';

export async function heartbeat(req: Request, res: Response): Promise<void> {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      res.status(400).json({ error: 'employeeId required' });
      return;
    }
    await pool.query(
      `UPDATE users SET last_active = NOW(), online_status = 'online' WHERE employee_id = $1`,
      [employeeId]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function setOffline(req: Request, res: Response): Promise<void> {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      res.status(400).json({ error: 'employeeId required' });
      return;
    }
    await pool.query(
      `UPDATE users SET online_status = 'offline', last_active = NOW() WHERE employee_id = $1`,
      [employeeId]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Set offline error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getOnlineStatus(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT employee_id, name, online_status, last_active,
              EXTRACT(EPOCH FROM (NOW() - last_active)) as seconds_ago
       FROM users
       WHERE employee_id IS NOT NULL`
    );
    const statuses = result.rows.map((row: any) => ({
      employeeId: row.employee_id,
      name: row.name,
      status: row.online_status === 'online' && row.seconds_ago < 120 ? 'online' : 'offline',
      lastActive: row.last_active,
      secondsAgo: Math.round(row.seconds_ago || 0)
    }));
    res.json(statuses);
  } catch (error: any) {
    console.error('Get online status error:', error);
    res.status(500).json({ error: error.message });
  }
}
