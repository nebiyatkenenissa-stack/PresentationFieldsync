import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM reports ORDER BY submitted_at DESC');
  return result.rows;
}

export async function getById(id: string): Promise<any> {
  const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return result.rows[0];
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO reports (
        report_id, employee_id, employee_name, supervisor_id,
        report_date, region, site_name, registrations,
        operational_status, attendance, work_hours,
        activities, equipment_status, materials_used,
        team_members, weather_conditions, community_feedback,
        challenges, issues, comments, submitted_at,
        latitude, longitude, gps_accuracy, gps_captured_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    RETURNING *`,
    [
      data.reportId, data.employeeId, data.employeeName,
      data.supervisorId, data.reportDate, data.region,
      data.siteName, data.registrations,
      data.operationalStatus, data.attendance, data.workHours,
      data.activities, data.equipmentStatus, data.materialsUsed,
      data.teamMembers, data.weatherConditions,
      data.communityFeedback, data.challenges,
      data.issues, data.comments, data.submittedAt || new Date().toISOString(),
      data.latitude || null,
      data.longitude || null,
      data.gpsAccuracy || null,
      data.gpsCapturedAt || null,
    ]
  );
  return result.rows[0];
}

export async function update(id: string, data: any): Promise<any> {
  const result = await pool.query(
    `UPDATE reports SET
        site_name = $1,
        registrations = $2,
        operational_status = $3,
        attendance = $4,
        work_hours = $5,
        activities = $6,
        equipment_status = $7,
        materials_used = $8,
        team_members = $9,
        weather_conditions = $10,
        community_feedback = $11,
        challenges = $12,
        issues = $13,
        comments = $14,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $15
    RETURNING *`,
    [
      data.siteName, data.registrations,
      data.operationalStatus, data.attendance, data.workHours,
      data.activities, data.equipmentStatus, data.materialsUsed,
      data.teamMembers, data.weatherConditions,
      data.communityFeedback, data.challenges,
      data.issues, data.comments, id,
    ]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<any> {
  const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}
