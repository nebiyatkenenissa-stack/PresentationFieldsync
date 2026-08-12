import { pool } from '../config/db.js';
import { saveBase64Photo } from '../utils/photo.js';

// Adds the grandfather_name column used to disambiguate citizen registrations.
// Safe to run on every boot (no-op once the column exists).
export async function ensureCitizenSchema(): Promise<void> {
  await pool.query('ALTER TABLE citizens ADD COLUMN IF NOT EXISTS grandfather_name TEXT');
}

// Lazily migrates legacy base64 photos (data URLs) stored in the DB into file
// URLs under /uploads. Keeps the citizens API response short and fast.
function normalizePhoto(row: any): any {
  if (row && row.photo && typeof row.photo === 'string' && row.photo.startsWith('data:')) {
    const url = saveBase64Photo(row.photo);
    if (url && row.national_id) {
      row.photo = url;
      pool.query('UPDATE citizens SET photo = $1 WHERE national_id = $2', [url, row.national_id])
        .catch((err: any) => console.warn('Photo migration failed:', err.message));
    }
  }
  return row;
}

export async function getAll(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM citizens ORDER BY created_at DESC');
  return result.rows.map(normalizePhoto);
}

export async function getByNationalId(nationalId: string): Promise<any> {
  const result = await pool.query('SELECT * FROM citizens WHERE national_id = $1', [nationalId]);
  return normalizePhoto(result.rows[0]);
}

export async function create(data: any): Promise<any> {
  const result = await pool.query(
    `INSERT INTO citizens (
        national_id, first_name, last_name, grandfather_name, date_of_birth,
        gender, phone, email, address, region,
        district, village, occupation, marital_status,
        registration_date, registered_by, registered_by_name,
        id_type, id_number, biometrics, photo,
        latitude, longitude, gps_accuracy, gps_captured_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    RETURNING *`,
    [
      data.nationalId, data.firstName, data.lastName,
      data.grandfatherName || null, data.dateOfBirth, data.gender, data.phone,
      data.email, data.address, data.region,
      data.district, data.village, data.occupation,
      data.maritalStatus, data.registrationDate,
      data.registeredBy, data.registeredByName,
      data.idType || null, data.idNumber || null, data.biometrics || false,
      data.photo || null,
      data.latitude || null,
      data.longitude || null,
      data.gpsAccuracy || null,
      data.gpsCapturedAt || null,
    ]
  );
  return result.rows[0];
}
