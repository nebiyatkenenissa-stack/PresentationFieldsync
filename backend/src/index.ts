import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { pool, pingDatabase } from './config/db.js';
import { ensureLocationTable, addMissingColumns, seedEthiopiaLocations } from './models/location.model.js';
import { ensureScreenTimeTable } from './models/screenTime.model.js';
import { ensureCitizenSchema } from './models/citizen.model.js';
import { requireAuth } from './middleware/auth.js';
import { ensureAdminExists } from './models/user.model.js';

import authRouter from './routes/auth.routes.js';
import { locationRouter, communityRouter } from './routes/location.routes.js';
import userRouter from './routes/user.routes.js';
import reportRouter from './routes/report.routes.js';
import citizenRouter from './routes/citizen.routes.js';
import leaveRouter from './routes/leave.routes.js';
import permissionRouter from './routes/permission.routes.js';
import syncRouter from './routes/sync.routes.js';
import taskRouter from './routes/task.routes.js';
import screenTimeRouter from './routes/screenTime.routes.js';
import auditRouter from './routes/audit.routes.js';
import alertRouter from './routes/alert.routes.js';
import verificationRouter from './routes/verification.routes.js';
import supervisorReportRouter from './routes/supervisorReport.routes.js';
import statusRouter from './routes/status.routes.js';

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When the frontend is built into ../frontend/dist (the Render one-service
// deploy), this API serves it too. Same origin, so no CORS and no VITE_API_BASE
// is needed. The check keeps local dev untouched: with no build present the
// folder simply does not exist and only /api + /uploads are served.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.set('json spaces', 2);

app.use('/uploads', express.static(config.uploadsDir));

// Upload folders are gitignored, so on a fresh deploy they do not exist yet and
// multer would throw ENOENT on the first photo upload.
fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.profileBackupsDir, { recursive: true });

app.use('/api/tasks', requireAuth, taskRouter);
app.use('/api/screen-time', requireAuth, screenTimeRouter);
app.use('/api/audit', requireAuth, auditRouter);
app.use('/api/alerts', requireAuth, alertRouter);
app.use('/api/verification', requireAuth, verificationRouter);
app.use('/api/supervisor-reports', requireAuth, supervisorReportRouter);

app.use('/api/locations', locationRouter);
app.use('/api/communities', communityRouter);
app.use('/api/users', requireAuth, userRouter);
app.use('/api/reports', requireAuth, reportRouter);
app.use('/api/citizens', requireAuth, citizenRouter);
app.use('/api/leaves', requireAuth, leaveRouter);
app.use('/api/permissions', requireAuth, permissionRouter);
app.use('/api/auth', authRouter);
app.use('/api/sync', requireAuth, syncRouter);
app.use('/api/status', requireAuth, statusRouter);

app.get('/api/test', (_req, res) => {
  res.json({ message: 'API is working!' });
});

app.get('/api/health', async (_req, res) => {
  try {
    await pingDatabase();
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

pool.connect(async (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL');
    try {
      await ensureLocationTable();
      await ensureScreenTimeTable();
      await addMissingColumns();
      await seedEthiopiaLocations();
      await ensureCitizenSchema();
      // Add online status columns if missing
      try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW()`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'offline'`);
        console.log('✅ Online status columns ensured');
      } catch (e: any) {
        console.warn('⚠️ Status columns issue:', e.message);
      }
      // Password reset (OTP) columns used by the forgot-password flow
      try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR(255)`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_sent_at TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_attempts INTEGER DEFAULT 0`);
        console.log('✅ Password reset columns ensured');
      } catch (e: any) {
        console.warn('⚠️ Password reset columns issue:', e.message);
      }
      // Admin tasks are scoped with target_role. Existing rows keep NULL, which
      // is the "ordinary task" bucket, so nothing about the current supervisor /
      // officer task lists changes -- only rows explicitly marked 'admin' are
      // shown on the administrator's own page.
      try {
        await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_role VARCHAR(50)`);
        console.log('✅ Task target_role column ensured');
      } catch (e: any) {
        console.warn('⚠️ Task target_role column issue:', e.message);
      }
      // The attendance module was removed, so its table is dropped along with
      // every record it holds. DROP TABLE IF EXISTS makes this idempotent: on a
      // database that has never had the table nothing happens, and on one that
      // has, the data goes away exactly once.
      try {
        await pool.query(`DROP TABLE IF EXISTS public.attendance`);
        console.log('🗑️  Attendance table dropped');
      } catch (e: any) {
        console.warn('⚠️ Attendance purge issue:', e.message);
      }
      // Seed the built-in administrator so a fresh database always has a way in.
      try {
        const result = await ensureAdminExists();
        console.log(
          result.created
            ? `✅ Administrator created: ${result.email} (must change password on first login)`
            : `ℹ️  Administrator already present: ${result.email}`
        );
      } catch (e: any) {
        console.warn('⚠️ Admin bootstrap issue:', e.message);
      }
    } catch (e: any) {
      console.warn('⚠️ Schema init issue:', e.message);
    }
  }
});

if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1y' }));
  // A missing upload must stay a 404. Without this the catch-all below would
  // answer /uploads/whatever.jpg with index.html and a 200, so the browser
  // would treat the HTML as an image and the client would never see the load
  // failure that should trigger the initials fallback.
  app.use(/^\/(uploads|api)\//, (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  // Path-less middleware on purpose: every request that did not match a static
  // file or an API route is handed index.html, so client-side routes deep-link
  // correctly. Express 5 wildcard patterns ('/*splat') skip the bare '/' root.
  app.use((_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      service: 'FieldSync API',
      hint: 'Frontend build not found at frontend/dist -- serving API only.',
    });
  });
}

app.listen(config.port, () => {
  console.log(`dYs? Server running on http://localhost:${config.port}`);
});
