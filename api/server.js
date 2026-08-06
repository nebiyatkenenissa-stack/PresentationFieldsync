// server.js – COMPLETE WITH ALL ROUTES + TEMPORARY PASSWORD + EMAIL + FORCE CHANGE + LOCATION HIERARCHY + LOGIN ROUTE
// FIX: Always return plain password in user creation response so client can store it locally.
// FIX: Added location_path column, fixed duplicate email/employee_id handling.
// ADDED: /api/locations/communities endpoint for community dropdown.

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===== EMAIL TRANSPORTER =====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===== HELPER: Generate temporary password (10 characters) =====
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.set('json spaces', 2);

// ============================================================
// ===== CHANGE PASSWORD ROUTE (FORCE PASSWORD CHANGE) – MOVED TO TOP =====
// ============================================================
app.post('/api/auth/change-password', async (req, res) => {
  console.log('🔑 Change password request received for:', req.body.email);
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Case-insensitive email lookup
    const trimmedEmail = email.trim().toLowerCase();
    const userResult = await pool.query(
      'SELECT id, password_hash, must_change_password FROM users WHERE LOWER(email) = $1',
      [trimmedEmail]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Verify current password
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ===== LOGIN ROUTE (server authentication) =====
// ============================================================
app.post('/api/login', async (req, res) => {
  console.log('🔑 Login request received for:', req.body.email);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Case‑insensitive email lookup
    const trimmedEmail = email.trim().toLowerCase();
    const userResult = await pool.query(
      `SELECT id, employee_id, name, email, role, region, supervisor_id,
              status, phone, shift, department, profile_photo,
              must_change_password, password_hash,
              country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
              location_path, created_at, updated_at
       FROM users WHERE LOWER(email) = $1`,
      [trimmedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Remove password_hash before sending
    delete user.password_hash;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== UPLOADS FOLDER & STATIC SERVING =====
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('📁 Created uploads folder');
}
app.use('/uploads', express.static(uploadDir));

// ===== MULTER CONFIG =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile_' + unique + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// ===== POSTGRESQL CONNECTION =====
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect(async (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL');
        await ensureLocationTable();
        await addMissingColumns();
    }
});

// ============================================================
// HELPER: Create locations table if not exists
// ============================================================
async function ensureLocationTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                level VARCHAR(20) NOT NULL CHECK (level IN ('country', 'region', 'zone', 'woreda', 'kebele', 'community')),
                parent_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, parent_id)
            );
        `);
        console.log('✅ Locations table verified');
    } catch (err) {
        console.warn('⚠️ Could not create locations table:', err.message);
    }
}

// ============================================================
// HELPER: Add missing columns if they don't exist
// ============================================================
async function addMissingColumns() {
    try {
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS shift VARCHAR(20) DEFAULT 'Day';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS country_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS woreda_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS kebele_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS community_id INTEGER REFERENCES locations(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS location_path VARCHAR(255);
            -- Ensure region column can hold long location paths
            ALTER TABLE users ALTER COLUMN region TYPE VARCHAR(255);
        `);
        console.log('✅ Database columns verified');
    } catch (err) {
        console.warn('⚠️ Could not add columns (they may already exist):', err.message);
    }
}

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
const supervisorReportsRouter = require('./routes/supervisorReports');

// Mount routers
app.use('/api/tasks', tasksRouter);
app.use('/api/screen-time', screenTimeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/supervisor-reports', supervisorReportsRouter);

// ============================================================
// LOCATION ROUTES
// ============================================================

// Get locations by level (e.g., /api/locations/level/country)
app.get('/api/locations/level/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const result = await pool.query(
            'SELECT id, name, parent_id FROM locations WHERE level = $1 ORDER BY name',
            [level]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get children of a parent ID (cascading dropdowns)
app.get('/api/locations/children/:parentId', async (req, res) => {
    try {
        const { parentId } = req.params;
        const result = await pool.query(
            'SELECT id, name, level FROM locations WHERE parent_id = $1 ORDER BY name',
            [parentId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== FIXED: Fetch communities by kebele_id (MUST be before the generic /:id route) =====
app.get('/api/locations/communities', async (req, res) => {
    const { kebele_id } = req.query;
    if (!kebele_id) {
        return res.status(400).json({ error: 'kebele_id is required' });
    }
    try {
        const result = await pool.query(
            'SELECT id, name FROM communities WHERE kebele_id = $1 ORDER BY name',
            [kebele_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching communities:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get location by ID (to fetch name for the 'region' fallback) – MUST be LAST
app.get('/api/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get supervisors by woreda ID
app.get('/api/users/supervisors-by-woreda/:woredaId', async (req, res) => {
    try {
        const { woredaId } = req.params;
        const result = await pool.query(
            `SELECT id, employee_id, name, email 
             FROM users 
             WHERE role = 'supervisor' 
               AND status = 'active' 
               AND woreda_id = $1
             ORDER BY name`,
            [woredaId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// REPORT ROUTES
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
// ATTENDANCE ROUTES
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
// CITIZEN ROUTES
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
// USER ROUTES (UPDATED: include new fields, full profile update)
// ============================================================
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, employee_id, name, email, role, region, supervisor_id, 
                    status, password_hash, phone, shift, department, profile_photo,
                    must_change_password, country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
                    location_path, created_at, updated_at 
             FROM users ORDER BY name`
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
            `SELECT id, employee_id, name, email, role, region, supervisor_id, 
                    status, password_hash, phone, shift, department, profile_photo,
                    must_change_password, country_id, region_id, zone_id, woreda_id, kebele_id, community_id,
                    location_path, created_at, updated_at 
             FROM users WHERE id = $1`,
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

// ===== POST /api/users – CREATES USER (WITH TEMP PASSWORD + EMAIL + LOCATION) =====
// Uses ON CONFLICT (email) to update if email exists, avoiding duplicate errors.
app.post('/api/users', async (req, res) => {
    try {
        const data = req.body;
        let plainPassword = data.password;
        let mustChange = data.mustChangePassword !== undefined ? data.mustChangePassword : false;

        // If the new user is a field officer, generate a temporary password
        if (data.role === 'field_officer') {
            plainPassword = generateTempPassword();
            mustChange = true;
        } else {
            // For other roles, if no password provided, use default
            if (!plainPassword) {
                if (data.role === 'manager') plainPassword = 'manager123';
                else if (data.role === 'supervisor') plainPassword = 'super123';
                else plainPassword = 'officer123';
            }
            mustChange = false;
        }

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Prepare location_path from region string or build from IDs
        const locationPath = data.locationPath || data.region || '';

        // Upsert on email conflict – this prevents duplicate email errors
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
                password_hash = EXCLUDED.password_hash,  -- update password if changed
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                data.id, data.employeeId, data.name, data.email, hashedPassword,
                data.role, data.region || null, data.supervisorId || null,
                data.status || 'active', data.createdAt || new Date().toISOString(),
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
                locationPath
            ]
        );

        const newUser = result.rows[0];
        delete newUser.password_hash;

        // Always return the plain password so client can store it locally
        newUser.temporaryPassword = plainPassword;

        // If field officer, send email with temporary password
        if (data.role === 'field_officer') {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: data.email,
                    subject: 'Your FieldSync Account',
                    html: `
                        <h3>Welcome to FieldSync</h3>
                        <p>Hello ${data.name},</p>
                        <p>Your FieldSync account has been created.</p>
                        <p><strong>Login Email:</strong> ${data.email}</p>
                        <p><strong>Temporary Password:</strong> ${plainPassword}</p>
                        <p>Please log in and change your password immediately.</p>
                        <p>Regards,<br>FieldSync Team</p>
                    `
                });
                console.log(`📧 Temporary password sent to ${data.email}`);
            } catch (emailErr) {
                console.error('❌ Failed to send email:', emailErr);
            }
        }

        res.status(201).json(newUser);
    } catch (error) {
        // If employee_id conflict occurs, we can try to update based on employee_id
        if (error.code === '23505' && error.constraint === 'users_employee_id_key') {
            try {
                // Update the existing user with the same employee_id
                const data = req.body;
                const hashedPassword = await bcrypt.hash(data.password || 'temp123', 10);
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
                        data.mustChangePassword !== undefined ? data.mustChangePassword : false,
                        data.country_id || null,
                        data.region_id || null,
                        data.zone_id || null,
                        data.woreda_id || null,
                        data.kebele_id || null,
                        data.community_id || null,
                        data.locationPath || data.region || '',
                        data.employeeId
                    ]
                );
                if (result.rows.length === 0) {
                    throw new Error('User not found for update');
                }
                const updatedUser = result.rows[0];
                delete updatedUser.password_hash;
                updatedUser.temporaryPassword = data.password || 'updated';
                res.status(200).json(updatedUser);
            } catch (updateErr) {
                console.error('Update on employee_id conflict failed:', updateErr);
                res.status(500).json({ error: updateErr.message });
            }
        } else {
            console.error('Error creating user:', error);
            res.status(500).json({ error: error.message });
        }
    }
});

// ===== PUT /api/users/:id – FULL PROFILE UPDATE (no password change) =====
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, phone, shift, department,
            profilePhoto
        } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        if (shift !== undefined) {
            updates.push(`shift = $${paramIndex++}`);
            values.push(shift);
        }
        if (department !== undefined) {
            updates.push(`department = $${paramIndex++}`);
            values.push(department);
        }
        if (profilePhoto !== undefined) {
            updates.push(`profile_photo = $${paramIndex++}`);
            values.push(profilePhoto);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        delete result.rows[0].password_hash;
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== DELETE /api/users/:id =====
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PHOTO UPLOAD ROUTE
// ============================================================
app.post('/api/users/:id/photo', upload.single('profilePhoto'), async (req, res) => {
    try {
        const userId = req.params.id;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const filePath = '/uploads/' + req.file.filename;
        const result = await pool.query(
            'UPDATE users SET profile_photo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [filePath, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ profilePhoto: filePath });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// LEAVE ROUTES (UPDATED POST + PUT)
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
                data.synced || false
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating leave:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/leaves/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const result = await pool.query(
            `UPDATE leaves SET
                employee_id = $1,
                employee_name = $2,
                start_date = $3,
                end_date = $4,
                reason = $5,
                type = $6,
                status = $7,
                approved_by = $8,
                approved_at = $9,
                synced = $10
            WHERE id = $11
            RETURNING *`,
            [
                data.employeeId,
                data.employeeName,
                data.startDate,
                data.endDate,
                data.reason,
                data.type,
                data.status,
                data.approvedBy,
                data.approvedAt,
                true,
                id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Leave not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating leave:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PERMISSION ROUTES (UPDATED POST + PUT)
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
                id, employee_id, employee_name, permission_type,
                start_date, end_date, reason, status, requested_at,
                approved_by, approved_at, synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
                data.synced || false
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/permissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
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
                synced = $10
            WHERE id = $11
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
                true,
                id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Permission not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SYNC ROUTE – EXTENDED WITH leave_update, permission_update, AND verification
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
                        data.synced || false
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
                        data.id
                    ]
                );
                break;

            case 'permission':
                result = await pool.query(
                    `INSERT INTO permissions (
                        id, employee_id, employee_name, permission_type,
                        start_date, end_date, reason, status, requested_at,
                        approved_by, approved_at, synced
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
                        data.synced || false
                    ]
                );
                break;

            case 'permission_update':
                result = await pool.query(
                    `UPDATE permissions SET
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
                        data.id
                    ]
                );
                break;

            case 'user':
                let hashedPw = data.password;
                if (data.password) {
                    hashedPw = await bcrypt.hash(data.password, 10);
                }
                // Use ON CONFLICT (email) to avoid duplicate email errors
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
                        locationPath
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
    console.log(`   POST /api/users/:id/photo`);
    console.log(`   POST /api/auth/change-password`);
    console.log(`   POST /api/login`);
    console.log(`   GET  /api/locations/level/:level`);
    console.log(`   GET  /api/locations/children/:parentId`);
    console.log(`   GET  /api/locations/:id`);
    console.log(`   GET  /api/locations/communities`);  // ← FIXED: now order is correct
    console.log(`   GET  /api/users/supervisors-by-woreda/:woredaId`);
    console.log(`   GET  /api/leaves`);
    console.log(`   POST /api/leaves`);
    console.log(`   PUT  /api/leaves/:id`);
    console.log(`   GET  /api/permissions`);
    console.log(`   POST /api/permissions`);
    console.log(`   PUT  /api/permissions/:id`);
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
    console.log(`   GET  /api/supervisor-reports`);
    console.log(`   POST /api/supervisor-reports`);
    console.log(`   PUT  /api/supervisor-reports/:id`);
    console.log(`   DELETE /api/supervisor-reports/:id`);
    console.log(`   POST /api/sync`);
});