import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM attendance ORDER BY date DESC');
  return result.rows;
}

export async function getByEmployee(employeeId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC',
    [employeeId]
  );
  return result.rows;
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO attendance (
        employee_id, employee_name, date, status,
        check_in, check_out, work_hours, region,
        supervisor_id, supervisor_name, notes,
        submitted_to_manager, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      data.employeeId, data.employeeName, data.date,
      data.status, data.checkIn, data.checkOut,
      data.workHours, data.region, data.supervisorId,
      data.supervisorName, data.notes,
      data.submittedToManager || false,
      data.submittedAt || new Date().toISOString(),
    ]
  );
  return result.rows[0];
}

export async function approve(
  id: string,
  approved: boolean,
  approvedBy: string,
  seenByManager: boolean
): Promise<any> {
  const result = await pool.query(
    `UPDATE attendance
     SET approved = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP,
         seen_by_manager = $3, seen_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [approved, approvedBy, seenByManager, id]
  );
  return result.rows[0];
}
