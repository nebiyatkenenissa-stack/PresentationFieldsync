import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  return result.rows;
}

export async function getByEmployee(employeeId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM tasks WHERE employee_id = $1 ORDER BY deadline ASC',
    [employeeId]
  );
  return result.rows;
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO tasks (
        id, employee_id, assigned_by, assigned_by_name,
        title, description, deadline, priority, status,
        created_at, updated_at, completed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.id, data.employeeId, data.assignedBy, data.assignedByName,
      data.title, data.description, data.deadline, data.priority,
      data.status || 'pending',
      data.createdAt || new Date().toISOString(),
      data.updatedAt || new Date().toISOString(),
      data.completedAt || null,
    ]
  );
  return result.rows[0];
}

export async function update(id: string, data: any): Promise<any> {
  const result = await pool.query(
    `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        deadline = COALESCE($3, deadline),
        priority = COALESCE($4, priority),
        status = COALESCE($5, status),
        completed_at = CASE WHEN $5 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *`,
    [data.title, data.description, data.deadline, data.priority, data.status, id]
  );
  return result.rows[0];
}

export async function updateStatus(id: string, status: string): Promise<any> {
  const result = await pool.query(
    `UPDATE tasks SET
        status = $1,
        completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *`,
    [status, id]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<any> {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}
