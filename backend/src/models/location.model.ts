import { pool } from '../config/db.js';

export async function ensureLocationTable(): Promise<void> {
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
}

export async function addMissingColumns(): Promise<void> {
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
    ALTER TABLE users ALTER COLUMN region TYPE TEXT;
    ALTER TABLE users ALTER COLUMN location_path TYPE TEXT;
    ALTER TABLE reports ALTER COLUMN region TYPE TEXT;
    ALTER TABLE attendance ALTER COLUMN region TYPE TEXT;
    ALTER TABLE supervisor_reports ALTER COLUMN region TYPE TEXT;
    ALTER TABLE supervisor_reports ALTER COLUMN officer_region TYPE TEXT;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS id_type VARCHAR(50);
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS id_number VARCHAR(100);
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS biometrics BOOLEAN DEFAULT FALSE;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS photo TEXT;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMP;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMP;
  `);
}

const ETHIOPIA_REGIONS: { name: string; zones: string[] }[] = [
  { name: 'Addis Ababa', zones: [] },
  { name: 'Afar', zones: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'] },
  {
    name: 'Amhara',
    zones: [
      'West Gojjam',
      'East Gojjam',
      'South Gondar',
      'North Gondar',
      'South Wollo',
      'North Wollo',
      'Wag Hemra',
      'Awi',
      'Oromia Special Zone',
    ],
  },
  {
    name: 'Benishangul-Gumuz',
    zones: ['Metekel', 'Kamashi', 'Assosa', 'Mao-Komo'],
  },
  { name: 'Dire Dawa', zones: [] },
  { name: 'Gambela', zones: ['Agnewak', 'Nuer', 'Majang', 'Itang'] },
  { name: 'Harari', zones: [] },
  {
    name: 'Oromia',
    zones: [
      'East Shewa',
      'West Shewa',
      'North Shewa',
      'South West Shewa',
      'East Hararghe',
      'West Hararghe',
      'Arsi',
      'West Arsi',
      'Bale',
      'East Wollega',
      'West Wollega',
      'Horo Guduru Welega',
      'Jimma',
      'Kellem Wollega',
      'Guji',
      'Borena',
      'Illubabor',
    ],
  },
  { name: 'Sidama', zones: ['Sidama', 'Hawassa'] },
  {
    name: 'Somali',
    zones: ['Sitti', 'Fafan', 'Jijiga', 'Nogob', 'Jarar', 'Dollo', 'Korahay', 'Shebelle'],
  },
  {
    name: 'South Ethiopia',
    zones: ['Gofa', 'Gamo', 'Wolayita', 'Konso', 'Ari', 'Basketo', 'Derashe'],
  },
  {
    name: 'South West Ethiopia Peoples',
    zones: ['Bench Sheko', 'Dawuro', 'Kaffa', 'Konta', 'Sheka', 'West Omo'],
  },
  {
    name: 'Tigray',
    zones: ['Central', 'Eastern', 'Southern', 'Western', 'Mekelle'],
  },
];

export async function seedEthiopiaLocations(): Promise<void> {
  const existing = await pool.query(
    `SELECT id FROM locations WHERE level = 'country' AND name = 'Ethiopia' AND parent_id IS NULL LIMIT 1`
  );
  if (existing.rows.length > 0) {
    return;
  }
  const countryResult = await pool.query(
    `INSERT INTO locations (name, level, parent_id) VALUES ('Ethiopia', 'country', NULL) RETURNING id`
  );
  const countryId = countryResult.rows[0].id;

  for (const region of ETHIOPIA_REGIONS) {
    const regionResult = await pool.query(
      `INSERT INTO locations (name, level, parent_id) VALUES ($1, 'region', $2)
       ON CONFLICT (name, parent_id) DO NOTHING RETURNING id`,
      [region.name, countryId]
    );
    if (regionResult.rows.length === 0) {
      continue;
    }
    const regionId = regionResult.rows[0].id;
    for (const zone of region.zones) {
      await pool.query(
        `INSERT INTO locations (name, level, parent_id) VALUES ($1, 'zone', $2)
         ON CONFLICT (name, parent_id) DO NOTHING`,
        [zone, regionId]
      );
    }
  }
}

export async function getByLevel(level: string): Promise<unknown[]> {
  const result = await pool.query(
    'SELECT id, name, parent_id FROM locations WHERE level = $1 ORDER BY name',
    [level]
  );
  return result.rows;
}

export async function getChildren(parentId: string | number): Promise<unknown[]> {
  const result = await pool.query(
    'SELECT id, name, level FROM locations WHERE parent_id = $1 ORDER BY name',
    [parentId]
  );
  return result.rows;
}

export async function getCommunitiesByKebele(kebeleId: string): Promise<unknown[]> {
  const result = await pool.query(
    'SELECT id, name FROM communities WHERE kebele_id = $1 ORDER BY name',
    [kebeleId]
  );
  return result.rows;
}

export async function getCommunityById(id: string): Promise<unknown> {
  const result = await pool.query(
    'SELECT id, name, kebele_id FROM communities WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function getLocationById(id: string | number): Promise<unknown> {
  const result = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
  return result.rows[0];
}
