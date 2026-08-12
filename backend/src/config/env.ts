import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT) || 5000,
  dbUser: process.env.DB_USER || 'postgres',
  dbHost: process.env.DB_HOST || 'localhost',
  dbName: process.env.DB_NAME || 'fieldsync_db',
  dbPassword: process.env.DB_PASSWORD || 'my13',
  dbPort: Number(process.env.DB_PORT) || 5432,
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  uploadsDir: path.resolve(__dirname, '../../uploads'),
};
