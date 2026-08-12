import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { pool, pingDatabase } from './config/db.js';
import { ensureLocationTable, addMissingColumns, seedEthiopiaLocations } from './models/location.model.js';
import { ensureScreenTimeTable } from './models/screenTime.model.js';
import { ensureCitizenSchema } from './models/citizen.model.js';

import authRouter from './routes/auth.routes.js';
import { locationRouter, communityRouter } from './routes/location.routes.js';
import userRouter from './routes/user.routes.js';
import reportRouter from './routes/report.routes.js';
import attendanceRouter from './routes/attendance.routes.js';
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

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.set('json spaces', 2);

app.use('/uploads', express.static(config.uploadsDir));

app.use('/api/tasks', taskRouter);
app.use('/api/screen-time', screenTimeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/alerts', alertRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/supervisor-reports', supervisorReportRouter);

app.use('/api/locations', locationRouter);
app.use('/api/communities', communityRouter);
app.use('/api/users', userRouter);
app.use('/api/reports', reportRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/citizens', citizenRouter);
app.use('/api/leaves', leaveRouter);
app.use('/api/permissions', permissionRouter);
app.use('/api/auth', authRouter);
app.use('/api', authRouter);
app.use('/api/sync', syncRouter);

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
    } catch (e: any) {
      console.warn('⚠️ Schema init issue:', e.message);
    }
  }
});

app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
});
