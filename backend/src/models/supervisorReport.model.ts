import { pool } from '../config/db.js';

export async function getAll(): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM supervisor_reports ORDER BY submitted_at DESC'
  );
  return result.rows;
}

export async function getBySupervisor(supervisorId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM supervisor_reports WHERE supervisor_id = $1 ORDER BY submitted_at DESC',
    [supervisorId]
  );
  return result.rows;
}

export async function getByOfficer(officerId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM supervisor_reports WHERE officer_id = $1 ORDER BY submitted_at DESC',
    [officerId]
  );
  return result.rows;
}

export async function create(data: any): Promise<any> {
  const isSelfReport =
    !data.officerId || data.officerId === 'null' || data.officerId === null;

  let params: any[];
  if (isSelfReport) {
    params = [
      data.id,
      data.supervisorId,
      data.supervisorName,
      null,
      null,
      null,
      data.reportDate,
      null,
      null,
      null,
      null,
      null,
      null,
      data.challenges || '',
      data.recommendations || '',
      null,
      data.status || 'submitted',
      data.submittedAt || new Date().toISOString(),
      data.region || null,
      'self_report',
      data.siteVisits !== undefined ? parseInt(data.siteVisits) : 0,
      data.issuesResolved !== undefined ? parseInt(data.issuesResolved) : 0,
      data.challenges || '',
      data.achievements || '',
      data.teamMorale || 'good',
      data.resourceStatus || 'adequate',
      data.overallStatus || 'good',
    ];
  } else {
    params = [
      data.id,
      data.supervisorId,
      data.supervisorName,
      data.officerId || null,
      data.officerName || null,
      data.officerRegion || null,
      data.reportDate,
      data.performance || 'good',
      data.attendance || 'good',
      data.quality || 'good',
      data.punctuality || 'good',
      data.teamwork || 'good',
      data.communication || 'good',
      data.comments || '',
      data.recommendations || '',
      data.overallRating || 3,
      data.status || 'submitted',
      data.submittedAt || new Date().toISOString(),
      data.region || null,
      'officer_report',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];
  }

  const result = await pool.query(
    `INSERT INTO supervisor_reports (
        id, supervisor_id, supervisor_name, officer_id, officer_name,
        officer_region, report_date, performance, attendance, quality,
        punctuality, teamwork, communication, comments, recommendations,
        overall_rating, status, submitted_at, region, type,
        site_visits, issues_resolved, challenges, achievements,
        team_morale, resource_status, overall_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function update(id: string, data: any): Promise<any> {
  const result = await pool.query(
    `UPDATE supervisor_reports SET
        performance = COALESCE($1, performance),
        attendance = COALESCE($2, attendance),
        quality = COALESCE($3, quality),
        punctuality = COALESCE($4, punctuality),
        teamwork = COALESCE($5, teamwork),
        communication = COALESCE($6, communication),
        comments = COALESCE($7, comments),
        recommendations = COALESCE($8, recommendations),
        overall_rating = COALESCE($9, overall_rating),
        status = COALESCE($10, status)
    WHERE id = $11
    RETURNING *`,
    [
      data.performance,
      data.attendance,
      data.quality,
      data.punctuality,
      data.teamwork,
      data.communication,
      data.comments,
      data.recommendations,
      data.overallRating,
      data.status,
      id,
    ]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<any> {
  const result = await pool.query(
    'DELETE FROM supervisor_reports WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}
