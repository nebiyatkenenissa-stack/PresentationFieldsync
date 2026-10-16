import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT) || 5000,
  // Neon (and every hosted Postgres) hands out a single pooled URL, so
  // DATABASE_URL takes priority over the individual parts when it is set.
  dbUrl: process.env.DATABASE_URL || '',
  dbUser: process.env.DB_USER || 'postgres',
  dbHost: process.env.DB_HOST || 'localhost',
  dbName: process.env.DB_NAME || 'fieldsync_db',
  dbPassword: process.env.DB_PASSWORD || 'my13',
  dbPort: Number(process.env.DB_PORT) || 5432,
  // Hosted databases refuse plaintext connections. Defaults to on whenever a
  // DATABASE_URL is present; a local postgres has no SSL, so DB_SSL=false wins.
  dbSsl:
    process.env.DB_SSL === 'false'
      ? false
      : process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : process.env.DATABASE_URL
          ? { rejectUnauthorized: false }
          : undefined,
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  jwtSecret: process.env.JWT_SECRET || 'my_jwt_secret_key',
  // Seed account for the built-in administrator, created on boot when it is
  // missing so a fresh database always has a way in.
  adminEmail: process.env.ADMIN_EMAIL || 'admin@fieldsync.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  adminName: process.env.ADMIN_NAME || 'System Administrator',
  adminEmployeeId: process.env.ADMIN_EMPLOYEE_ID || 'ADM001',
  uploadsDir: path.resolve(__dirname, '../../uploads'),
  profileBackupsDir: path.resolve(__dirname, '../../uploads/profile-backups'),
};
