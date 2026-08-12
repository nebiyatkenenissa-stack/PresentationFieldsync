import { pool } from '../config/db.js';

export async function ensureScreenTimeTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS screen_time (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name VARCHAR(255),
      date DATE,
      login_time VARCHAR(10),
      logout_time VARCHAR(10),
      total_screen_time INTEGER DEFAULT 0,
      idle_time INTEGER DEFAULT 0,
      session_start TIMESTAMP,
      screen_time_limit INTEGER DEFAULT 28800,
      trust_score INTEGER DEFAULT 0,
      is_logged_in BOOLEAN DEFAULT FALSE,
      verified BOOLEAN DEFAULT FALSE,
      verified_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE screen_time ADD COLUMN IF NOT EXISTS idle_time INTEGER DEFAULT 0;
    ALTER TABLE screen_time ADD COLUMN IF NOT EXISTS session_start TIMESTAMP;
  `);
}

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM screen_time ORDER BY date DESC');
  return result.rows;
}

export async function getByEmployee(employeeId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM screen_time WHERE employee_id = $1 ORDER BY date DESC',
    [employeeId]
  );
  return result.rows;
}

export async function upsert(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO screen_time (
        id, employee_id, employee_name, date, login_time, logout_time,
        total_screen_time, idle_time, session_start, screen_time_limit, trust_score, is_logged_in,
        verified, verified_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO UPDATE SET
        login_time = EXCLUDED.login_time,
        logout_time = EXCLUDED.logout_time,
        total_screen_time = EXCLUDED.total_screen_time,
        idle_time = EXCLUDED.idle_time,
        session_start = EXCLUDED.session_start,
        is_logged_in = EXCLUDED.is_logged_in,
        trust_score = EXCLUDED.trust_score,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      data.id, data.employeeId, data.employeeName, data.date,
      data.loginTime, data.logoutTime,
      data.totalScreenTime || 0,
      data.idleTime || 0,
      data.sessionStart || null,
      data.screenTimeLimit || 28800,
      data.trustScore || 0,
      data.isLoggedIn || false,
      data.verified || false,
      data.verifiedBy || null,
      data.createdAt || new Date().toISOString(),
      data.updatedAt || new Date().toISOString(),
    ]
  );
  return result.rows[0];
}

export async function update(id: string, body: any): Promise<any> {
  const { screenTimeLimit, verified, verifiedBy } = body;
  const result = await pool.query(
    `UPDATE screen_time SET
        screen_time_limit = COALESCE($1, screen_time_limit),
        verified = COALESCE($2, verified),
        verified_by = COALESCE($3, verified_by),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *`,
    [screenTimeLimit, verified, verifiedBy, id]
  );
  return result.rows[0];
}

export async function updateVerified(
  id: string,
  limitHours: number,
  verified: boolean,
  verifiedBy: string
): Promise<any> {
  const result = await pool.query(
    `UPDATE screen_time SET
        screen_time_limit = $1,
        verified = $2,
        verified_by = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *`,
    [limitHours * 3600, verified, verifiedBy, id]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<any> {
  const result = await pool.query('DELETE FROM screen_time WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}
