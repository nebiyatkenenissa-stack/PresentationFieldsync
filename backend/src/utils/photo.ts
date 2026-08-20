import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config/env.js';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
};

// Converts a base64 data-URL photo into a file in the uploads directory and
// returns its public URL path (e.g. /uploads/citizen_abc123.jpg). If the value
// is already a URL path it is returned unchanged. Returns null when no photo
// or an invalid value is provided.
export function saveBase64Photo(dataUrl?: string | null): string | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:')) return dataUrl;

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1].split(';')[0];
  const ext = MIME_EXT[mime] || '.jpg';
  const base64 = match[2];
  // Content-based filename so retries of the same photo reuse the same file.
  const hash = crypto.createHash('md5').update(base64).digest('hex').slice(0, 16);
  const filename = `citizen_${hash}${ext}`;
  const filePath = path.join(config.uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  }

  return '/uploads/' + filename;
}

// Save a base64 report attachment to disk and return { name, type, size, url }.
// If the attachment already has a url (from a previous sync) it is returned unchanged.
export function saveReportAttachment(att: { name: string; type: string; size: number; data?: string; url?: string }): { name: string; type: string; size: number; url: string } {
  if (att.url) return att;
  if (!att.data || !att.data.startsWith('data:')) return { name: att.name, type: att.type, size: att.size, url: '' };

  const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { name: att.name, type: att.type, size: att.size, url: '' };

  const base64 = match[2];
  const hash = crypto.createHash('md5').update(base64).digest('hex').slice(0, 16);
  const ext = path.extname(att.name) || MIME_EXT[match[1].split(';')[0]] || '.bin';
  const filename = `report_${hash}${ext}`;
  const filePath = path.join(config.uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  }

  return { name: att.name, type: att.type, size: att.size, url: '/uploads/' + filename };
}
