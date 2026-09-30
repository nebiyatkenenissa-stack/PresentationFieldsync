import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM alerts ORDER BY timestamp DESC');
  return result.rows;
}

export async function create(data: any): Promise<any> {
  // Idempotent by id: if the same message is re-sent (e.g. an offline queue
  // retry racing the original POST), the existing row is updated instead of a
  // duplicate being inserted – so recipients never see the message twice.
  const result = await pool.query(
    `INSERT INTO alerts (
        id, title, message, priority, type, timestamp, read,
        target_all, target_employee_id, sent_by, sent_by_name,
        target_users, sent_by_role
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        priority = EXCLUDED.priority,
        type = EXCLUDED.type,
        timestamp = EXCLUDED.timestamp,
        read = EXCLUDED.read,
        target_all = EXCLUDED.target_all,
        target_employee_id = EXCLUDED.target_employee_id,
        sent_by = EXCLUDED.sent_by,
        sent_by_name = EXCLUDED.sent_by_name,
        target_users = EXCLUDED.target_users,
        sent_by_role = EXCLUDED.sent_by_role
    RETURNING *, (xmax = 0) AS is_inserted`,
    [
      data.id,
      data.title,
      data.message,
      data.priority || 'medium',
      data.type || 'emergency',
      data.timestamp || new Date().toISOString(),
      data.read || false,
      data.targetAll !== undefined ? data.targetAll : true,
      data.targetEmployeeId || null,
      data.sentBy,
      data.sentByName,
      data.targetUsers ? JSON.stringify(data.targetUsers) : null,
      data.sentByRole || null,
    ]
  );
  return result.rows[0];
}

export async function markRead(id: string, read: boolean): Promise<any> {
  const result = await pool.query('UPDATE alerts SET read = $1 WHERE id = $2 RETURNING *', [
    read,
    id,
  ]);
  return result.rows[0];
}

export async function clearAll(): Promise<void> {
  await pool.query('DELETE FROM alerts');
}
