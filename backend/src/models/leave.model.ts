import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM leaves ORDER BY created_at DESC');
  return result.rows;
}

export async function upsert(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO leaves (
        id, employee_id, employee_name, start_date, end_date,
        reason, type, status, created_at, approved_by, approved_at, synced
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        employee_name = EXCLUDED.employee_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        reason = EXCLUDED.reason,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        synced = EXCLUDED.synced,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      data.id,
      data.employeeId,
      data.employeeName,
      data.startDate,
      data.endDate,
      data.reason,
      data.type,
      data.status || 'pending',
      data.createdAt || new Date().toISOString(),
      data.approvedBy || null,
      data.approvedAt || null,
      data.synced || false,
    ]
  );
  return result.rows[0];
}

export async function update(id: string, data: any): Promise<any> {
  const result = await pool.query(
    `UPDATE leaves SET
        employee_id = $1,
        employee_name = $2,
        start_date = $3,
        end_date = $4,
        reason = $5,
        type = $6,
        status = $7,
        approved_by = $8,
        approved_at = $9,
        synced = $10
    WHERE id = $11
    RETURNING *`,
    [
      data.employeeId,
      data.employeeName,
      data.startDate,
      data.endDate,
      data.reason,
      data.type,
      data.status,
      data.approvedBy,
      data.approvedAt,
      true,
      id,
    ]
  );
  return result.rows[0];
}

export async function updateStatus(
  id: string,
  status: string,
  approvedBy: string,
  approvedAt: string
): Promise<any> {
  const result = await pool.query(
    `UPDATE leaves SET
        status = $1,
        approved_by = $2,
        approved_at = $3,
        synced = true
    WHERE id = $4
    RETURNING *`,
    [status, approvedBy, approvedAt, id]
  );
  return result.rows[0];
}
