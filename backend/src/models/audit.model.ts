import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  return result.rows;
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO audit_logs (id, user_id, user_name, action, details, timestamp, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.id,
      data.userId,
      data.userName,
      data.action,
      data.details || '',
      data.timestamp || new Date().toISOString(),
      data.ip || '127.0.0.1',
    ]
  );
  return result.rows[0];
}

export async function clearAll(): Promise<void> {
  await pool.query('DELETE FROM audit_logs');
}

export async function deleteById(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM audit_logs WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
