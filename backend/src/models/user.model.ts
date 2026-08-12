import { pool } from '../config/db.js';

const USER_COLUMNS = `id, employee_id, name, email, role, region, supervisor_id,
    status, password_hash, phone, shift, department, profile_photo,
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
        phone, shift, department, profile_photo, must_change_password,
        country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
        location_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (email) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        region = EXCLUDED.region,
        supervisor_id = EXCLUDED.supervisor_id,
        status = EXCLUDED.status,
        phone = EXCLUDED.phone,
        shift = EXCLUDED.shift,
        department = EXCLUDED.department,
        profile_photo = EXCLUDED.profile_photo,
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
      data.phone || null, data.shift || 'Day', data.department || null,
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
        shift = $9,
        department = $10,
        profile_photo = $11,
        must_change_password = $12,
        country_id = $13,
        region_id = $14,
        zone_id = $15,
        woreda_id = $16,
        kebele_id = $17,
        community_id = $18,
        location_path = $19,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = $20
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
  if (body.shift !== undefined) {
    updates.push(`shift = $${paramIndex++}`);
    values.push(body.shift);
  }
  if (body.department !== undefined) {
    updates.push(`department = $${paramIndex++}`);
    values.push(body.department);
  }
  if (body.profilePhoto !== undefined) {
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
