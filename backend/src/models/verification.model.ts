import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM verification_history ORDER BY timestamp DESC'
  );
  return result.rows;
}

export async function getByOfficer(officerId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM verification_history WHERE officer_id = $1 ORDER BY timestamp DESC',
    [officerId]
  );
  return result.rows;
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO verification_history (
        id, officer_id, officer_name, question, answer, success,
        score, response_time, timestamp, message, penalties
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      data.id,
      data.officerId,
      data.officerName,
      data.question,
      data.answer,
      data.success || false,
      data.score || 0,
      data.responseTime || 0,
      data.timestamp || new Date().toISOString(),
      data.message || '',
      data.penalties || [],
    ]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM verification_history WHERE id = $1 RETURNING id',
    [id]
  );
  return (result.rowCount || 0) > 0;
}

export async function clearAll(): Promise<void> {
  await pool.query('DELETE FROM verification_history');
}
