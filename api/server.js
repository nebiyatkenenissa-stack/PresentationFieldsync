// server.js - COMPLETE WITH ALL ROUTES (REPORTS, ATTENDANCE, CITIZENS, USERS, LEAVES, PERMISSIONS, TASKS, SCREEN TIME, AUDIT, ALERTS, VERIFICATION, SUPERVISOR REPORTS)
// AND SYNC CASES FOR ALL ENTITIES

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.set('json spaces', 2);

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test Connection
pool.connect((err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL');
    }
});

// ============================================================
// TEST ROUTE
// ============================================================
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// ============================================================
// IMPORT ROUTERS
// ============================================================
const tasksRouter = require('./routes/tasks');
const screenTimeRouter = require('./routes/screenTime');
const auditRouter = require('./routes/audit');
const alertsRouter = require('./routes/alerts');
const verificationRouter = require('./routes/verification');
const supervisorReportsRouter = require('./routes/supervisorReports'); // NEW

// Mount routers
app.use('/api/tasks', tasksRouter);
app.use('/api/screen-time', screenTimeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/supervisor-reports', supervisorReportsRouter); // NEW

// ============================================================
// REPORT ROUTES (unchanged)
// ============================================================
app.get('/api/reports', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports ORDER BY submitted_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reports', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO reports (
                report_id, employee_id, employee_name, supervisor_id,
                report_date, region, site_name, registrations,
                operational_status, attendance, work_hours,
                activities, equipment_status, materials_used,
                team_members, weather_conditions, community_feedback,
                challenges, issues, comments, submitted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *`,
            [
                data.reportId, data.employeeId, data.employeeName,
                data.supervisorId, data.reportDate, data.region,
                data.siteName, data.registrations,
                data.operationalStatus, data.attendance, data.workHours,
                data.activities, data.equipmentStatus, data.materialsUsed,
                data.teamMembers, data.weatherConditions,
                data.communityFeedback, data.challenges,
                data.issues, data.comments, data.submittedAt || new Date().toISOString()
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
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
                data.issues, data.comments, id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ATTENDANCE ROUTES (unchanged)
// ============================================================
app.get('/api/attendance', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM attendance ORDER BY date DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const result = await pool.query(
            'SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC',
            [employeeId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/attendance', async (req, res) => {
    try {
        const data = req.body;
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
                data.submittedAt || new Date().toISOString()
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/attendance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved, approved_by, seen_by_manager } = req.body;
        const result = await pool.query(
            `UPDATE attendance 
             SET approved = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP,
                 seen_by_manager = $3, seen_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [approved, approved_by, seen_by_manager, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// CITIZEN ROUTES (unchanged)
// ============================================================
app.get('/api/citizens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM citizens ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/citizens/national/:nationalId', async (req, res) => {
    try {
        const { nationalId } = req.params;
        const result = await pool.query('SELECT * FROM citizens WHERE national_id = $1', [nationalId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Citizen not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/citizens', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO citizens (
                national_id, first_name, last_name, date_of_birth,
                gender, phone, email, address, region,
                district, village, occupation, marital_status,
                registration_date, registered_by, registered_by_name,
                id_type, id_number, biometrics
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *`,
            [
                data.nationalId, data.firstName, data.lastName,
                data.dateOfBirth, data.gender, data.phone,
                data.email, data.address, data.region,
                data.district, data.village, data.occupation,
                data.maritalStatus, data.registrationDate,
                data.registeredBy, data.registeredByName,
                data.idType, data.idNumber, data.biometrics || false
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// USER ROUTES (unchanged)
// ============================================================
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, employee_id, name, email, role, region, supervisor_id, status, password_hash, created_at FROM users ORDER BY name'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT id, employee_id, name, email, role, region, supervisor_id, status, password_hash, created_at FROM users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO users (
                id, employee_id, name, email, password_hash,
                role, region, supervisor_id, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                region = EXCLUDED.region,
                status = EXCLUDED.status,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                data.id, data.employeeId, data.name, data.email, data.password,
                data.role, data.region, data.supervisorId || null,
                data.status || 'active', data.createdAt || new Date().toISOString()
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// LEAVE ROUTES (unchanged)
// ============================================================
app.get('/api/leaves', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leaves ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leaves', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO leaves (
                employee_id, employee_name, start_date, end_date,
                reason, type, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                data.employeeId, data.employeeName, data.startDate,
                data.endDate, data.reason, data.type,
                data.status || 'pending', data.createdAt || new Date().toISOString()
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PERMISSION ROUTES (unchanged)
// ============================================================
app.get('/api/permissions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM permissions ORDER BY requested_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/permissions', async (req, res) => {
    try {
        const data = req.body;
        const result = await pool.query(
            `INSERT INTO permissions (
                employee_id, employee_name, permission_type,
                start_date, end_date, reason, status, requested_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                data.employeeId, data.employeeName, data.permissionType,
                data.startDate, data.endDate, data.reason,
                data.status || 'pending', data.requestedAt || new Date().toISOString()
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SYNC ROUTE – EXTENDED WITH TASKS, SCREEN TIME, AUDIT, ALERTS, VERIFICATION, SUPERVISOR REPORTS
// ============================================================
app.post('/api/sync', async (req, res) => {
    try {
        const { type, data } = req.body;
        let result;

        switch (type) {
            case 'report':
                result = await pool.query(
                    `INSERT INTO reports (
                        report_id, employee_id, employee_name, supervisor_id,
                        report_date, region, site_name, registrations,
                        operational_status, attendance, work_hours,
                        activities, equipment_status, materials_used,
                        team_members, weather_conditions, community_feedback,
                        challenges, issues, comments, submitted_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                    ON CONFLICT (report_id) DO UPDATE SET
                        site_name = EXCLUDED.site_name,
                        registrations = EXCLUDED.registrations,
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
                        data.issues, data.comments, data.submittedAt || new Date().toISOString()
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
                        data.submittedAt || new Date().toISOString()
                    ]
                );
                break;

            case 'citizen':
                result = await pool.query(
                    `INSERT INTO citizens (
                        national_id, first_name, last_name, date_of_birth,
                        gender, phone, email, address, region,
                        district, village, occupation, marital_status,
                        registration_date, registered_by, registered_by_name,
                        id_type, id_number, biometrics
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    ON CONFLICT (national_id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *`,
                    [
                        data.nationalId, data.firstName, data.lastName,
                        data.dateOfBirth, data.gender, data.phone,
                        data.email, data.address, data.region,
                        data.district, data.village, data.occupation,
                        data.maritalStatus, data.registrationDate,
                        data.registeredBy, data.registeredByName,
                        data.idType, data.idNumber, data.biometrics || false
                    ]
                );
                break;

            case 'leave':
                result = await pool.query(
                    `INSERT INTO leaves (
                        employee_id, employee_name, start_date, end_date,
                        reason, type, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *`,
                    [
                        data.employeeId, data.employeeName, data.startDate,
                        data.endDate, data.reason, data.type,
                        data.status || 'pending', data.createdAt || new Date().toISOString()
                    ]
                );
                break;

            case 'permission':
                result = await pool.query(
                    `INSERT INTO permissions (
                        employee_id, employee_name, permission_type,
                        start_date, end_date, reason, status, requested_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *`,
                    [
                        data.employeeId, data.employeeName, data.permissionType,
                        data.startDate, data.endDate, data.reason,
                        data.status || 'pending', data.requestedAt || new Date().toISOString()
                    ]
                );
                break;

            case 'user':
                result = await pool.query(
                    `INSERT INTO users (
                        id, employee_id, name, email, password_hash,
                        role, region, supervisor_id, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        role = EXCLUDED.role,
                        status = EXCLUDED.status,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *`,
                    [
                        data.id, data.employeeId, data.name, data.email, data.password,
                        data.role, data.region, data.supervisorId || null,
                        data.status || 'active', data.createdAt || new Date().toISOString()
                    ]
                );
                break;

            case 'user_status_update':
                result = await pool.query(
                    'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                    [data.status, data.userId]
                );
                break;

            case 'user_delete':
                result = await pool.query(
                    'DELETE FROM users WHERE id = $1 RETURNING *',
                    [data.userId]
                );
                break;

            // TASKS
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
                        data.completedAt || null
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

            // SCREEN TIME
            case 'screen_time':
                result = await pool.query(
                    `INSERT INTO screen_time (
                        id, employee_id, employee_name, date, login_time, logout_time,
                        total_screen_time, screen_time_limit, trust_score, is_logged_in,
                        verified, verified_by, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (id) DO UPDATE SET
                        login_time = EXCLUDED.login_time,
                        logout_time = EXCLUDED.logout_time,
                        total_screen_time = EXCLUDED.total_screen_time,
                        is_logged_in = EXCLUDED.is_logged_in,
                        trust_score = EXCLUDED.trust_score,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *`,
                    [
                        data.id, data.employeeId, data.employeeName, data.date,
                        data.loginTime, data.logoutTime,
                        data.totalScreenTime || 0,
                        data.screenTimeLimit || 28800,
                        data.trustScore || 0,
                        data.isLoggedIn || false,
                        data.verified || false,
                        data.verifiedBy || null,
                        data.createdAt || new Date().toISOString(),
                        data.updatedAt || new Date().toISOString()
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

            // AUDIT LOGS
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
                        data.ip || '127.0.0.1'
                    ]
                );
                break;

            // ALERTS
            case 'alert':
                result = await pool.query(
                    `INSERT INTO alerts (
                        id, title, message, priority, type, timestamp, read,
                        target_all, target_employee_id, sent_by, sent_by_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        message = EXCLUDED.message,
                        read = EXCLUDED.read,
                        timestamp = EXCLUDED.timestamp
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
                        data.sentByName
                    ]
                );
                break;

            case 'alert_read':
                result = await pool.query(
                    'UPDATE alerts SET read = $1 WHERE id = $2 RETURNING *',
                    [data.read, data.alertId]
                );
                break;

            // VERIFICATION
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
                        data.penalties || []
                    ]
                );
                break;

            // SUPERVISOR REPORTS (NEW)
            case 'supervisor_report':
                result = await pool.query(
                    `INSERT INTO supervisor_reports (
                        id, supervisor_id, supervisor_name, officer_id, officer_name,
                        officer_region, report_date, performance, attendance, quality,
                        punctuality, teamwork, communication, comments, recommendations,
                        overall_rating, status, submitted_at, region, type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
                        status = EXCLUDED.status
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
                        data.type || 'officer_report'
                    ]
                );
                break;

            default:
                return res.status(400).json({ error: 'Unknown sync type: ' + type });
        }

        res.json({
            success: true,
            data: result?.rows?.[0] || null,
            message: `${type} synced successfully`
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        });
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /api/test`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/reports`);
    console.log(`   POST /api/reports`);
    console.log(`   PUT  /api/reports/:id`);
    console.log(`   DELETE /api/reports/:id`);
    console.log(`   GET  /api/attendance`);
    console.log(`   POST /api/attendance`);
    console.log(`   PUT  /api/attendance/:id`);
    console.log(`   GET  /api/citizens`);
    console.log(`   POST /api/citizens`);
    console.log(`   GET  /api/users`);
    console.log(`   POST /api/users`);
    console.log(`   PUT  /api/users/:id`);
    console.log(`   DELETE /api/users/:id`);
    console.log(`   GET  /api/leaves`);
    console.log(`   POST /api/leaves`);
    console.log(`   GET  /api/permissions`);
    console.log(`   POST /api/permissions`);
    console.log(`   GET  /api/tasks`);
    console.log(`   POST /api/tasks`);
    console.log(`   PUT  /api/tasks/:id`);
    console.log(`   DELETE /api/tasks/:id`);
    console.log(`   GET  /api/screen-time`);
    console.log(`   POST /api/screen-time`);
    console.log(`   PUT  /api/screen-time/:id`);
    console.log(`   DELETE /api/screen-time/:id`);
    console.log(`   GET  /api/audit`);
    console.log(`   POST /api/audit`);
    console.log(`   DELETE /api/audit`);
    console.log(`   GET  /api/alerts`);
    console.log(`   POST /api/alerts`);
    console.log(`   DELETE /api/alerts`);
    console.log(`   GET  /api/verification`);
    console.log(`   POST /api/verification`);
    console.log(`   DELETE /api/verification`);
    console.log(`   GET  /api/supervisor-reports`);    // NEW
    console.log(`   POST /api/supervisor-reports`);    // NEW
    console.log(`   PUT  /api/supervisor-reports/:id`); // NEW
    console.log(`   DELETE /api/supervisor-reports/:id`); // NEW
    console.log(`   POST /api/sync`);
});