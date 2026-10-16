import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';

// Columns safe to return from the list/detail endpoints. password_hash is
// deliberately excluded: it was being shipped to every client, and the offline
// merge code stored it as the user's local plaintext `password`. A later
// offline profile save then pushed that hash back as if it were a new password
// and re-hashed it, permanently locking the account out.
const USER_COLUMNS = `id, employee_id, name, email, role, region, supervisor_id,
    status, phone, gender, shift, department, profile_photo,
    must_change_password, country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
    location_path, created_at, updated_at`;

export async function findByEmailForLogin(email: string): Promise<any> {
  const result = await pool.query(
    `SELECT id, employee_id, name, email, role, region, supervisor_id,
            status, phone, shift, department, profile_photo,
            must_change_password, password_hash,
            country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
            location_path, created_at, updated_at
     FROM users WHERE LOWER(email) = $1`,
    [email]
  );
  return result.rows[0];
}

export async function findByEmailForPassword(email: string): Promise<any> {
  const result = await pool.query(
    'SELECT id, password_hash, must_change_password FROM users WHERE LOWER(email) = $1',
    [email]
  );
  return result.rows[0];
}

export async function updatePassword(id: string, newHash: string): Promise<void> {
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newHash, id]
  );
}

export async function findByEmailForReset(email: string): Promise<any> {
  const result = await pool.query(
    `SELECT id, name, email, status, reset_code_hash, reset_code_expires,
            reset_code_sent_at, reset_attempts
     FROM users WHERE LOWER(email) = $1`,
    [email]
  );
  return result.rows[0];
}

export async function setResetCode(id: string, codeHash: string, expiresAt: Date): Promise<void> {
  await pool.query(
    `UPDATE users SET reset_code_hash = $1, reset_code_expires = $2,
            reset_code_sent_at = CURRENT_TIMESTAMP, reset_attempts = 0,
            updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [codeHash, expiresAt, id]
  );
}

export async function incrementResetAttempts(id: string): Promise<number> {
  const result = await pool.query(
    `UPDATE users SET reset_attempts = COALESCE(reset_attempts, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING reset_attempts`,
    [id]
  );
  return result.rows[0]?.reset_attempts ?? 0;
}

export async function clearResetCode(id: string): Promise<void> {
  await pool.query(
    `UPDATE users SET reset_code_hash = NULL, reset_code_expires = NULL,
            reset_code_sent_at = NULL, reset_attempts = 0,
            updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
}

export async function setPasswordFromReset(id: string, newHash: string): Promise<number> {
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = false,
            reset_code_hash = NULL, reset_code_expires = NULL,
            reset_code_sent_at = NULL, reset_attempts = 0,
            updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newHash, id]
  );
  return result.rowCount ?? 0;
}

export async function getAllUsers(): Promise<any[]> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY name`);
  return result.rows;
}

export async function getUserById(id: string): Promise<any> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function findByEmailExact(email: string): Promise<any> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

export async function resetUserPassword(id: string, hash: string): Promise<void> {
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hash, id]
  );
}

export async function createOrUpdateUser(
  data: any,
  hashedPassword: string,
  mustChange: boolean
): Promise<any> {
  const locationPath = data.locationPath || data.region || '';
  const result = await pool.query(
    `INSERT INTO users (
        id, employee_id, name, email, password_hash,
        role, region, supervisor_id, status, created_at,
        phone, gender, shift, department, profile_photo, must_change_password,
        country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
        location_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    ON CONFLICT (email) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        region = EXCLUDED.region,
        supervisor_id = EXCLUDED.supervisor_id,
        status = EXCLUDED.status,
        phone = EXCLUDED.phone,
        gender = EXCLUDED.gender,
        shift = EXCLUDED.shift,
        department = EXCLUDED.department,
        profile_photo = COALESCE(EXCLUDED.profile_photo, users.profile_photo),
        must_change_password = EXCLUDED.must_change_password,
        country_id = EXCLUDED.country_id,
        region_id = EXCLUDED.region_id,
        zone_id = EXCLUDED.zone_id,
        woreda_id = EXCLUDED.woreda_id,
        kebele_id = EXCLUDED.kebele_id,
        community_id = EXCLUDED.community_id,
        location_path = EXCLUDED.location_path,
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      data.id, data.employeeId, data.name, data.email, hashedPassword,
      data.role, data.region || null, data.supervisorId || null,
      data.status || 'active', data.createdAt || new Date().toISOString(),
      data.phone || null, data.gender || null, data.shift || 'Day', data.department || null,
      data.profilePhoto || null, mustChange,
      data.country_id || null, data.region_id || null, data.zone_id || null,
      data.woreda_id || null, data.kebele_id || null, data.community_id || null,
      locationPath,
    ]
  );
  return result.rows[0];
}

export async function updateUserByEmployeeId(
  data: any,
  hashedPassword: string,
  mustChange: boolean
): Promise<any> {
  const result = await pool.query(
    `UPDATE users SET
        name = $1,
        email = $2,
        password_hash = $3,
        role = $4,
        region = $5,
        supervisor_id = $6,
        status = $7,
        phone = $8,
        gender = $9,
        shift = $10,
        department = $11,
        profile_photo = $12,
        must_change_password = $13,
        country_id = $14,
        region_id = $15,
        zone_id = $16,
        woreda_id = $17,
        kebele_id = $18,
        community_id = $19,
        location_path = $20,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = $21
    RETURNING *`,
    [
      data.name,
      data.email,
      hashedPassword,
      data.role,
      data.region || null,
      data.supervisorId || null,
      data.status || 'active',
      data.phone || null,
      data.gender || null,
      data.shift || 'Day',
      data.department || null,
      data.profilePhoto || null,
      mustChange,
      data.country_id || null,
      data.region_id || null,
      data.zone_id || null,
      data.woreda_id || null,
      data.kebele_id || null,
      data.community_id || null,
      data.locationPath || data.region || '',
      data.employeeId,
    ]
  );
  return result.rows[0];
}

export async function updateUserProfile(id: string, body: any): Promise<any> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (body.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }
  if (body.employeeId !== undefined) {
    updates.push(`employee_id = $${paramIndex++}`);
    values.push(body.employeeId);
  }
  if (body.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(body.email);
  }
  if (body.phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(body.phone);
  }
  if (body.gender !== undefined) {
    updates.push(`gender = $${paramIndex++}`);
    values.push(body.gender || null);
  }
  if (body.shift !== undefined) {
    updates.push(`shift = $${paramIndex++}`);
    values.push(body.shift);
  }
  if (body.department !== undefined) {
    updates.push(`department = $${paramIndex++}`);
    values.push(body.department);
  }
  if (body.profilePhoto !== undefined && body.profilePhoto !== null) {
    updates.push(`profile_photo = $${paramIndex++}`);
    values.push(body.profilePhoto);
  }
  if (body.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(body.status);
  }
  if (body.role !== undefined) {
    updates.push(`role = $${paramIndex++}`);
    values.push(body.role);
  }
  if (body.supervisorId !== undefined) {
    updates.push(`supervisor_id = $${paramIndex++}`);
    values.push(body.supervisorId);
  }
  if (body.region !== undefined) {
    updates.push(`region = $${paramIndex++}`);
    values.push(body.region);
  }
  if (body.country_id !== undefined) {
    updates.push(`country_id = $${paramIndex++}`);
    values.push(body.country_id);
  }
  if (body.region_id !== undefined) {
    updates.push(`region_id = $${paramIndex++}`);
    values.push(body.region_id);
  }
  if (body.zone_id !== undefined) {
    updates.push(`zone_id = $${paramIndex++}`);
    values.push(body.zone_id);
  }
  if (body.woreda_id !== undefined) {
    updates.push(`woreda_id = $${paramIndex++}`);
    values.push(body.woreda_id);
  }
  if (body.kebele_id !== undefined) {
    updates.push(`kebele_id = $${paramIndex++}`);
    values.push(body.kebele_id);
  }
  if (body.community_id !== undefined) {
    updates.push(`community_id = $${paramIndex++}`);
    values.push(body.community_id);
  }
  if (body.locationPath !== undefined) {
    updates.push(`location_path = $${paramIndex++}`);
    values.push(body.locationPath);
  }

  if (updates.length === 0) return null;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function deleteUser(id: string): Promise<any> {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

export async function updateUserPhoto(id: string, filePath: string): Promise<any> {
  const result = await pool.query(
    'UPDATE users SET profile_photo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [filePath, id]
  );
  return result.rows[0];
}

export async function getCurrentPhoto(id: string): Promise<string | null> {
  const result = await pool.query('SELECT profile_photo FROM users WHERE id = $1', [id]);
  return result.rows[0]?.profile_photo || null;
}

export async function getSupervisorsByWoreda(woredaId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, employee_id, name, email
     FROM users
     WHERE role = 'supervisor'
       AND status = 'active'
       AND woreda_id = $1
     ORDER BY name`,
    [woredaId]
  );
  return result.rows;
}

// Seed the built-in administrator so a fresh database always has a way in.
// Runs at boot rather than behind an HTTP route: an unauthenticated
// POST /api/admin/bootstrap would be callable by anyone who can reach the
// port, and the check does not belong on the request path anyway.
export async function ensureAdminExists(): Promise<{ created: boolean; email: string }> {
  const email = config.adminEmail;
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows.length > 0) return { created: false, email };

  const hashed = await bcrypt.hash(config.adminPassword, 10);
  // ON CONFLICT DO NOTHING keeps this safe when several instances boot at once.
  await pool.query(
    `INSERT INTO users (id, employee_id, name, email, password_hash, role, region, status, department, must_change_password)
     VALUES (gen_random_uuid()::text, $1, $2, LOWER($3), $4, 'admin', 'All', 'active', 'System Administration', TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [config.adminEmployeeId, config.adminName, email, hashed]
  );

  return { created: true, email };
}
