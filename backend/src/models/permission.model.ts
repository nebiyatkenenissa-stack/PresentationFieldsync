import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM permissions ORDER BY requested_at DESC');
  return result.rows;
}

export async function upsert(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO permissions (
        id, employee_id, employee_name, permission_type,
        start_date, end_date, reason, status, requested_at,
        approved_by, approved_at, synced, reject_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        employee_name = EXCLUDED.employee_name,
        permission_type = EXCLUDED.permission_type,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        reject_reason = EXCLUDED.reject_reason,
        synced = EXCLUDED.synced,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      data.id,
      data.employeeId,
      data.employeeName,
      data.permissionType,
      data.startDate,
      data.endDate,
      data.reason,
      data.status || 'pending',
      data.requestedAt || new Date().toISOString(),
      data.approvedBy || null,
      data.approvedAt || null,
      data.synced || false,
      data.rejectReason || null,
    ]
  );
  return result.rows[0];
}

export async function update(id: string, data: any): Promise<any> {
  const result = await pool.query(
    `UPDATE permissions SET
        employee_id = $1,
        employee_name = $2,
        permission_type = $3,
        start_date = $4,
        end_date = $5,
        reason = $6,
        status = $7,
        approved_by = $8,
        approved_at = $9,
        reject_reason = $10,
        synced = $11
    WHERE id = $12
    RETURNING *`,
    [
      data.employeeId,
      data.employeeName,
      data.permissionType,
      data.startDate,
      data.endDate,
      data.reason,
      data.status,
      data.approvedBy,
      data.approvedAt,
      data.rejectReason || null,
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
  approvedAt: string,
  rejectReason?: string | null
): Promise<any> {
  const result = await pool.query(
    `UPDATE permissions SET
        status = $1,
        approved_by = $2,
        approved_at = $3,
        reject_reason = $4,
        synced = true
    WHERE id = $5
    RETURNING *`,
    [status, approvedBy, approvedAt, rejectReason || null, id]
  );
  return result.rows[0];
}
