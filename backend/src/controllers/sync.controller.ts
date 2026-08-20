import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { transporter } from '../config/mail.js';
import { config } from '../config/env.js';
import { saveBase64Photo, saveReportAttachment } from '../utils/photo.js';

export async function sync(req: Request, res: Response): Promise<void> {
  try {
    const { type, data } = req.body;
    let result: any;

    switch (type) {
      case 'report':
        result = await pool.query(
          `INSERT INTO reports (
              report_id, employee_id, employee_name, supervisor_id,
              report_date, region, site_name, registrations,
              operational_status, attendance, work_hours,
              activities, equipment_status, materials_used,
              team_members, weather_conditions, community_feedback,
              challenges, issues, comments, submitted_at,
              latitude, longitude, gps_accuracy, gps_captured_at,
              attachments
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          ON CONFLICT (report_id) DO UPDATE SET
              site_name = EXCLUDED.site_name,
              registrations = EXCLUDED.registrations,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              gps_accuracy = EXCLUDED.gps_accuracy,
              gps_captured_at = EXCLUDED.gps_captured_at,
              attachments = EXCLUDED.attachments,
              updated_at = CURRENT_TIMESTAMP
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
            data.attachments ? JSON.stringify(
              (Array.isArray(data.attachments) ? data.attachments : []).map(saveReportAttachment)
            ) : null,
          ]
        );
        break;

      case 'attendance':
        result = await pool.query(
          `INSERT INTO attendance (
              employee_id, employee_name, date, status,
              check_in, check_out, work_hours, region,
              supervisor_id, supervisor_name, notes,
              submitted_to_manager, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              check_in = EXCLUDED.check_in,
              check_out = EXCLUDED.check_out,
              work_hours = EXCLUDED.work_hours
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
        break;

      case 'citizen': {
        // Business rule: the same first + last name is allowed, but only when
        // the grandfather name is different. An exact match on all three means
        // the same person was registered twice — skip the insert so the local
        // queue clears without duplicating the record on the server.
        if (data.firstName && data.lastName) {
          const dup = await pool.query(
            `SELECT national_id FROM citizens
             WHERE LOWER(first_name) = LOWER($1)
               AND LOWER(last_name) = LOWER($2)
               AND LOWER(COALESCE(grandfather_name, '')) = LOWER(COALESCE($3, ''))`,
            [data.firstName, data.lastName, data.grandfatherName || '']
          );
          if (dup.rows.length > 0) {
            console.warn(`⏭️ Duplicate citizen skipped (same first+last+grandfather): ${data.firstName} ${data.lastName} ${data.grandfatherName}`);
            res.json({
              success: true,
              data: dup.rows[0],
              message: 'citizen already exists (duplicate first+last+grandfather)',
            });
            return;
          }
        }
        result = await pool.query(
          `INSERT INTO citizens (
              national_id, first_name, last_name, grandfather_name, date_of_birth,
              gender, phone, email, address, region,
              district, village, occupation, marital_status,
              registration_date, registered_by, registered_by_name,
              id_type, id_number, biometrics, photo,
              latitude, longitude, gps_accuracy, gps_captured_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (national_id) DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              grandfather_name = EXCLUDED.grandfather_name,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              photo = EXCLUDED.photo,
              id_type = EXCLUDED.id_type,
              id_number = EXCLUDED.id_number,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              gps_accuracy = EXCLUDED.gps_accuracy,
              gps_captured_at = EXCLUDED.gps_captured_at,
              updated_at = CURRENT_TIMESTAMP
          RETURNING *`,
          [
            data.nationalId, data.firstName, data.lastName,
            data.grandfatherName || null, data.dateOfBirth, data.gender, data.phone,
            data.email, data.address, data.region,
            data.district, data.village, data.occupation,
            data.maritalStatus, data.registrationDate,
            data.registeredBy, data.registeredByName,
            data.idType || null, data.idNumber || null, data.biometrics || false,
            saveBase64Photo(data.photo),
            data.latitude || null,
            data.longitude || null,
            data.gpsAccuracy || null,
            data.gpsCapturedAt || null,
          ]
        );
        break;
      }

      case 'leave':
        result = await pool.query(
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
        break;

      case 'leave_update':
        result = await pool.query(
          `UPDATE leaves SET
              status = $1,
              approved_by = $2,
              approved_at = $3,
              synced = true
          WHERE id = $4
          RETURNING *`,
          [
            data.status,
            data.approvedBy,
            data.approvedAt || new Date().toISOString(),
            data.id,
          ]
        );
        break;

      case 'permission':
        result = await pool.query(
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
        break;

      case 'permission_update':
        result = await pool.query(
          `UPDATE permissions SET
              status = $1,
              approved_by = $2,
              approved_at = $3,
              reject_reason = $4,
              synced = true
          WHERE id = $5
          RETURNING *`,
          [
            data.status,
            data.approvedBy,
            data.approvedAt || new Date().toISOString(),
            data.rejectReason || null,
            data.id,
          ]
        );
        break;

      case 'user': {
        const plainPw =
          data.password ||
          (data.role === 'manager'
            ? 'manager123'
            : data.role === 'supervisor'
              ? 'super123'
              : 'officer123');
        const hashedPw = await bcrypt.hash(plainPw, 10);
        const locationPath = data.locationPath || data.region || '';
        result = await pool.query(
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
            data.id, data.employeeId, data.name, data.email, hashedPw,
            data.role, data.region || null, data.supervisorId || null,
            data.status || 'active', data.createdAt || new Date().toISOString(),
            data.phone || null,
            data.shift || 'Day',
            data.department || null,
            data.profilePhoto || null,
            data.mustChangePassword !== undefined ? data.mustChangePassword : true,
            data.country_id || null,
            data.region_id || null,
            data.zone_id || null,
            data.woreda_id || null,
            data.kebele_id || null,
            data.community_id || null,
            locationPath,
          ]
        );

        if (data.role === 'field_officer' || data.role === 'supervisor') {
          try {
            await transporter.sendMail({
              from: config.emailUser,
              to: data.email,
              subject: 'Your FieldSync Account',
              html: `
                  <h3>Welcome to FieldSync</h3>
                  <p>Hello ${data.name},</p>
                  <p>Your FieldSync account has been created with the role of <strong>${data.role === 'supervisor' ? 'Supervisor' : 'Field Officer'}</strong>.</p>
                  <p><strong>Login Email:</strong> ${data.email}</p>
                  <p><strong>Password:</strong> ${plainPw}</p>
                  <p>Please log in and change your password if required.</p>
                  <p>Regards,<br>FieldSync Team</p>
              `,
            });
            console.log(`📧 Password sent to ${data.email}`);
          } catch (emailErr: any) {
            console.error('❌ Failed to send email:', emailErr);
          }
        }
        break;
      }

      case 'user_status_update':
        result = await pool.query(
          'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [data.status, data.userId]
        );
        break;

      case 'user_update':
        result = await pool.query(
          `UPDATE users SET
              name = $1,
              email = $2,
              phone = $3,
              shift = $4,
              department = $5,
              profile_photo = $6,
              region = $7,
              location_path = $8,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
          RETURNING *`,
          [
            data.name,
            data.email,
            data.phone || null,
            data.shift || 'Day',
            data.department || null,
            data.profilePhoto || null,
            data.region || null,
            data.locationPath || data.region || '',
            data.id,
          ]
        );
        break;

      case 'user_delete':
        result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [
          data.userId,
        ]);
        break;

      case 'task':
        result = await pool.query(
          `INSERT INTO tasks (
              id, employee_id, assigned_by, assigned_by_name,
              title, description, deadline, priority, status,
              created_at, updated_at, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              deadline = EXCLUDED.deadline,
              priority = EXCLUDED.priority,
              status = EXCLUDED.status,
              completed_at = EXCLUDED.completed_at,
              updated_at = CURRENT_TIMESTAMP
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
        break;

      case 'task_update':
        result = await pool.query(
          `UPDATE tasks SET
              status = $1,
              completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *`,
          [data.status, data.taskId]
        );
        break;

      case 'screen_time':
        result = await pool.query(
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
        break;

      case 'screen_time_update':
        result = await pool.query(
          `UPDATE screen_time SET
              screen_time_limit = $1,
              verified = $2,
              verified_by = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *`,
          [data.limit * 3600, data.verified, data.verifiedBy, data.id]
        );
        break;

      case 'screen_time_delete':
        result = await pool.query(
          'DELETE FROM screen_time WHERE id = $1 RETURNING *',
          [data.id]
        );
        break;

      case 'verification_delete':
        result = await pool.query(
          'DELETE FROM verification_history WHERE id = $1 RETURNING *',
          [data.id]
        );
        break;

      case 'audit':
        result = await pool.query(
          `INSERT INTO audit_logs (id, user_id, user_name, action, details, timestamp, ip)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
               details = EXCLUDED.details,
               timestamp = EXCLUDED.timestamp
           RETURNING *`,
          [
            data.id,
            data.userId,
            data.userName,
            data.action,
            data.details || '',
            data.timestamp || new Date().toISOString(),
            data.ip || '127.0.0.1',
          ]
        );
        break;

      case 'alert':
        result = await pool.query(
          `INSERT INTO alerts (
              id, title, message, priority, type, timestamp, read,
              target_all, target_employee_id, sent_by, sent_by_name,
              target_users, sent_by_role
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              message = EXCLUDED.message,
              read = EXCLUDED.read,
              timestamp = EXCLUDED.timestamp,
              target_all = EXCLUDED.target_all,
              target_employee_id = EXCLUDED.target_employee_id,
              target_users = EXCLUDED.target_users,
              sent_by_role = EXCLUDED.sent_by_role
          RETURNING *`,
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
        break;

      case 'alert_read':
        result = await pool.query('UPDATE alerts SET read = $1 WHERE id = $2 RETURNING *', [
          data.read,
          data.alertId,
        ]);
        break;

      case 'verification':
        result = await pool.query(
          `INSERT INTO verification_history (
              id, officer_id, officer_name, question, answer, success,
              score, response_time, timestamp, message, penalties
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
              answer = EXCLUDED.answer,
              success = EXCLUDED.success,
              score = EXCLUDED.score,
              response_time = EXCLUDED.response_time,
              message = EXCLUDED.message,
              penalties = EXCLUDED.penalties
          RETURNING *`,
          [
            data.id,
            data.officerId,
            data.officerName,
            data.question,
            data.answer,
            data.success || false,
            data.score || 0,
            data.responseTime || 0,
            data.timestamp || new Date().toISOString(),
            data.message || '',
            data.penalties || [],
          ]
        );
        break;

      case 'supervisor_report':
        result = await pool.query(
          `INSERT INTO supervisor_reports (
              id, supervisor_id, supervisor_name, officer_id, officer_name,
              officer_region, report_date, performance, attendance, quality,
              punctuality, teamwork, communication, comments, recommendations,
              overall_rating, status, submitted_at, region, type,
              verification_count, verification_passed, verification_score,
              verification_penalties, verification_notes,
              screen_time_minutes, screen_time_idle_minutes, screen_time_trust_score,
              attachments, site_visits, issues_resolved, achievements,
              team_morale, resource_status, overall_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
          ON CONFLICT (id) DO UPDATE SET
              performance = EXCLUDED.performance,
              attendance = EXCLUDED.attendance,
              quality = EXCLUDED.quality,
              punctuality = EXCLUDED.punctuality,
              teamwork = EXCLUDED.teamwork,
              communication = EXCLUDED.communication,
              comments = EXCLUDED.comments,
              recommendations = EXCLUDED.recommendations,
              overall_rating = EXCLUDED.overall_rating,
              status = EXCLUDED.status,
              verification_count = EXCLUDED.verification_count,
              verification_passed = EXCLUDED.verification_passed,
              verification_score = EXCLUDED.verification_score,
              verification_penalties = EXCLUDED.verification_penalties,
              verification_notes = EXCLUDED.verification_notes,
              screen_time_minutes = EXCLUDED.screen_time_minutes,
              screen_time_idle_minutes = EXCLUDED.screen_time_idle_minutes,
              screen_time_trust_score = EXCLUDED.screen_time_trust_score,
              attachments = EXCLUDED.attachments,
              site_visits = EXCLUDED.site_visits,
              issues_resolved = EXCLUDED.issues_resolved,
              achievements = EXCLUDED.achievements,
              team_morale = EXCLUDED.team_morale,
              resource_status = EXCLUDED.resource_status,
              overall_status = EXCLUDED.overall_status
          RETURNING *`,
          [
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
            data.type || 'officer_report',
            data.verificationCount || 0,
            data.verificationPassed || 0,
            data.verificationScore || 0,
            data.verificationPenalties || 0,
            data.verificationNotes || '',
            data.screenTimeMinutes || 0,
            data.screenTimeIdleMinutes || 0,
            data.screenTimeTrustScore || 0,
            data.attachments ? JSON.stringify(
              (Array.isArray(data.attachments) ? data.attachments : []).map(saveReportAttachment)
            ) : null,
            data.siteVisits || null,
            data.issuesResolved || null,
            data.achievements || null,
            data.teamMorale || null,
            data.resourceStatus || null,
            data.overallStatus || null,
          ]
        );
        break;

      default:
        res.status(400).json({ error: 'Unknown sync type: ' + type });
        return;
    }

    res.json({
      success: true,
      data: result?.rows?.[0] || null,
      message: `${type} synced successfully`,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
}
