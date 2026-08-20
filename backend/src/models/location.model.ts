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

  // The old schema stored community id/kebele_id as text. Rebuild it with
  // proper integer columns + a unique constraint, preserving any existing data.
  const legacyCols = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = 'communities' AND column_name = 'kebele_id'`
  );
  if (legacyCols.rows.length > 0 && legacyCols.rows[0].data_type === 'character varying') {
    await pool.query(`ALTER TABLE communities RENAME TO communities_legacy`);
    await pool.query(`
      CREATE TABLE communities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        kebele_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, kebele_id)
      )
    `);
    await pool.query(`
      INSERT INTO communities (id, name, kebele_id)
      SELECT c.id::integer, c.name, c.kebele_id::integer
      FROM communities_legacy c
      JOIN locations l ON l.id = c.kebele_id::integer
      WHERE c.id ~ '^[0-9]+$' AND c.kebele_id ~ '^[0-9]+$'
    `);
    await pool.query(`
      SELECT setval('communities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM communities))
    `);
    await pool.query(`DROP TABLE communities_legacy`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS communities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      kebele_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, kebele_id)
    )
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
    -- Region/district/village can hold full hierarchical location paths
    -- (e.g. "Ethiopia > Amhara > ... > Kebele 01") which exceed VARCHAR(50)
    ALTER TABLE citizens ALTER COLUMN region TYPE TEXT;
    ALTER TABLE citizens ALTER COLUMN district TYPE TEXT;
    ALTER TABLE citizens ALTER COLUMN village TYPE TEXT;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMP;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
    ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMP;
    -- File attachments for reports (stored as JSONB)
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS attachments JSONB;
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS attachments JSONB;
    -- Self-report fields
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS site_visits INTEGER;
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS issues_resolved INTEGER;
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS achievements TEXT;
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS team_morale VARCHAR(20);
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS resource_status VARCHAR(20);
    ALTER TABLE supervisor_reports ADD COLUMN IF NOT EXISTS overall_status VARCHAR(20);
  `);

  // community_id on users references the `communities` table (a dropdown id),
  // NOT a row in `locations`. Fix the FK for tables that pointed at locations.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE c.conname = 'users_community_id_fkey'
          AND c.confrelid = 'locations'::regclass
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_community_id_fkey;
        ALTER TABLE users
          ADD CONSTRAINT users_community_id_fkey
          FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
}

const ETHIOPIA_REGIONS: { name: string; zones: { name: string; woredas: string[] }[] }[] = [
  {
    name: 'Addis Ababa',
    zones: [
      {
        name: 'Addis Ketema',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
      {
        name: 'Akaky Kaliti',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09'],
      },
      {
        name: 'Arada',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
      {
        name: 'Bole',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10', 'Woreda 11', 'Woreda 12', 'Woreda 13', 'Woreda 14'],
      },
      {
        name: 'Gulele',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
      {
        name: 'Kirkos',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
      {
        name: 'Kolfe Keranio',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
      {
        name: 'Lideta',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09'],
      },
      {
        name: 'Nifas Silk-Lafto',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09'],
      },
      {
        name: 'Yeka',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10', 'Woreda 11'],
      },
      {
        name: 'Lemi Kura',
        woredas: ['Woreda 01', 'Woreda 02', 'Woreda 03', 'Woreda 04', 'Woreda 05', 'Woreda 06', 'Woreda 07', 'Woreda 08', 'Woreda 09', 'Woreda 10'],
      },
    ],
  },
  {
    name: 'Afar',
    zones: [
      {
        name: 'Zone 1',
        woredas: ['Afambo', 'Asayita', 'Aura', 'Chifra', 'Dubti', 'Elidar', 'Koneba', 'Mille'],
      },
      {
        name: 'Zone 2',
        woredas: ['Abala', 'Afdera', 'Berhale', 'Dallol', 'Erebti', 'Gulina', 'Megale'],
      },
      {
        name: 'Zone 3',
        woredas: ['Amibara', 'Argoba Special Woreda', 'Awash Fentale', 'Bure Mudaytu', 'Dulecha', 'Gewane'],
      },
      {
        name: 'Zone 4',
        woredas: ['Aura', 'Ewa', 'Teru', 'Yalo'],
      },
      {
        name: 'Zone 5',
        woredas: ["Ada'ar", 'Dewe', 'Hadele Ele', 'Hara', 'Haruka', "Simurobi Gele'alo", 'Telalek'],
      },
    ],
  },
  {
    name: 'Amhara',
    zones: [
      {
        name: 'West Gojjam',
        woredas: ['Achefer', 'Bahir Dar Zuria', 'Bure', 'Dega Damot', 'Jabi Tehnan', 'Mecha', 'Sekela', 'Wemberma', 'Yilmana Densa'],
      },
      {
        name: 'East Gojjam',
        woredas: ['Aneded', 'Awabel', 'Baso Liben', 'Debre Elias', 'Dejen', 'Enarj Enawga', 'Enemay', 'Gozamin', 'Hulet Ej Enese', 'Machakel', 'Shebel Berenta', 'Sinan'],
      },
      {
        name: 'South Gondar',
        woredas: ['Alefa', 'Dera', 'East Belessa', 'Ebenat', 'Fogera', 'Lay Gayint', 'Libo Kemkem', 'Misraq Este', 'Simada', 'Tach Gayint', 'West Belessa'],
      },
      {
        name: 'North Gondar',
        woredas: ['Armachiho', 'Chilga', 'Dabat', 'Gondar Zuria', 'Jan Amora', 'Lay Armachiho', 'Metemma', 'Qwara', 'Tach Armachiho', 'Tsegede', 'Wogera'],
      },
      {
        name: 'South Wollo',
        woredas: ['Albuko', 'Amba Sel', 'Debre Sina', 'Dessie Zuria', 'Kalu', 'Kelala', 'Kutaber', 'Legambo', 'Magdala', 'Mekdela', 'Sayint', 'Tehuledere', 'Tenta', 'Wegde', 'Were Babu', 'Were Ilu'],
      },
      {
        name: 'North Wollo',
        woredas: ['Bugna', 'Dawunt', 'Delanta', 'Gidan', 'Guba Lafto', 'Habru', 'Lasta', 'Meket', 'Wadla'],
      },
      {
        name: 'Wag Hemra',
        woredas: ['Abergele', 'Dehana', 'Gaz Bele', 'Sekota', 'Ziquala'],
      },
      {
        name: 'Awi',
        woredas: ['Ankasha Guagusa', 'Banja', 'Dangila', 'Faggeta Lekoma', 'Guagusa Shikudad', 'Jawi', 'Zigem'],
      },
      {
        name: 'Oromia Special Zone',
        woredas: ['Artuma Fursi', 'Bati', 'Dewa Chefa', 'Jile Timuga', 'Kemise'],
      },
    ],
  },
  {
    name: 'Benishangul-Gumuz',
    zones: [
      {
        name: 'Metekel',
        woredas: ['Bullen', 'Dangur', 'Dibate', 'Guba', 'Mandura', 'Pawi', 'Wembera'],
      },
      {
        name: 'Kamashi',
        woredas: ['Agalo Mite', 'Belo Jegonfoy', 'Kamashi', 'Sirba Abay', 'Yaso'],
      },
      {
        name: 'Assosa',
        woredas: ['Assosa', 'Bambasi', 'Komosha', 'Kurmuk', 'Mao-Komo', 'Oda Bildigilu', 'Sherkole'],
      },
      {
        name: 'Mao-Komo',
        woredas: ['Mao-Komo Special Woreda'],
      },
    ],
  },
  {
    name: 'Dire Dawa',
    zones: [
      {
        name: 'Dire Dawa City',
        woredas: ['Dire Dawa Town', 'Gurgura', 'Shenkor', 'Arba', 'Legehare', 'Harotie', 'Urabii', 'Weteru'],
      },
    ],
  },
  {
    name: 'Gambela',
    zones: [
      { name: 'Agnewak', woredas: ['Abobo', 'Dimma', 'Gambela Zuria', 'Gog'] },
      { name: 'Nuer', woredas: ['Jikawo', 'Lare', 'Madany', 'Wanthao'] },
      { name: 'Majang', woredas: ['Majang'] },
      { name: 'Itang', woredas: ['Itang'] },
    ],
  },
  {
    name: 'Harari',
    zones: [
      {
        name: 'Harari City',
        woredas: ['Amir Nur', 'Abadir', 'Jegol', 'Sofi', 'Erer', 'Sukutar'],
      },
    ],
  },
  {
    name: 'Oromia',
    zones: [
      {
        name: 'East Shewa',
        woredas: ["Ada'a", 'Adama', 'Adami Tulu Jido Kombolcha', 'Boset', 'Dugda', 'Fentale', 'Gimbichu', 'Liben Chukala', 'Lome', 'Merti'],
      },
      {
        name: 'West Shewa',
        woredas: ['Ambo Zuria', 'Dendi', 'Ejere', 'Elfeta', 'Ginde Beret', 'Jeldu', 'Jibat', 'Liben Jawi', 'Meta Robi', 'Mida Woremo', 'Nono', 'Toke Kutaye', 'Walmara'],
      },
      {
        name: 'North Shewa',
        woredas: ["Abichu Gne'A", 'Aleltu', 'Antsokiyana Gemza', 'Asagirt', 'Bereh', 'Degem', 'Girar Jarso', 'Hidabu Abote', 'Kuyu', 'Qimbibit', 'Warra Jarso', 'Wuchale', 'Yaya Gulele'],
      },
      {
        name: 'South West Shewa',
        woredas: ['Bacho', 'Dawo', 'Elu', 'Enemorna Ener', 'Ilu', 'Seden Sodo', 'Tole', 'Waliso', 'Wonchi'],
      },
      {
        name: 'East Hararghe',
        woredas: ['Bedeno', 'Chiro', 'Deder', 'Doba', 'Gemechis', 'Gola Oda', 'Goro Gutu', 'Gumbi Bordede', 'Gursum', 'Haromaya', 'Jarso', 'Kersa', 'Kurfa Chele', 'Malka Balo', 'Mesela', 'Meta', 'Meyumuluke', 'Midhega Tola'],
      },
      {
        name: 'West Hararghe',
        woredas: ['Anchar', 'Boke', 'Chiro Zuria', 'Daro Lebu', 'Habro', 'Kuni', 'Mechkel', 'Miesso', 'Oda Bultum', 'Tulo'],
      },
      {
        name: 'Arsi',
        woredas: ['Aseko', 'Bale Gasegar', 'Bekoji', 'Chole', 'Digeluna Tijo', 'Diksis', 'Dodota', 'Enkelo Wabe', 'Gololcha', 'Guna', 'Hitosa', 'Jeju', 'Limuna Bilbilo', 'Munesa', 'Robe', 'Seru', 'Shirka', 'Sude', 'Tena', 'Ziway Dugda'],
      },
      {
        name: 'West Arsi',
        woredas: ['Adaba', 'Arsi Negele', 'Dodola', 'Gedeb Asasa', 'Kofele', 'Kore', 'Shashemene Zuria', 'Siraro', 'Wondo'],
      },
      {
        name: 'Bale',
        woredas: ['Agarfa', 'Berbere', 'Dawe Kachen', 'Dinsho', 'Gaseer', 'Ginir', 'Gololcha', 'Goro', 'Guradamole', 'Harena Buluk', 'Lege Hida', 'Meda Welabu', 'Raytu', 'Seweyna', 'Sinana'],
      },
      {
        name: 'East Wollega',
        woredas: ['Bila Seyo', 'Diga', 'Gida Ayana', 'Gobu Seyo', 'Gudeya Bila', 'Guto Wayu', 'Haro Limmu', 'Ibantu', 'Jimma Arjo', 'Limmu', 'Nunu Kumba', 'Sibu Sire', 'Wama Hagalo', 'Wayu Tuka'],
      },
      {
        name: 'West Wollega',
        woredas: ['Ayra', 'Babo Gambel', 'Begi', 'Boji Chokorsa', 'Boji Dirmaji', 'Genji', 'Gimbi', 'Guliso', 'Hawa Welele', 'Homa', 'Jarso', 'Kondala', 'Lalo Asabi', 'Mana Sibu', 'Nejo', 'Nole Kaba', 'Sayo', 'Yubdo'],
      },
      {
        name: 'Horo Guduru Welega',
        woredas: ['Abay Chomen', 'Abe Dongoro', 'Amuru Jarte', 'Guduru', 'Horo', 'Jarte Ardidi', 'Jimma Genete', 'Jimma Rare'],
      },
      {
        name: 'Jimma',
        woredas: ['Botor Tolay', 'Chora Botor', 'Dedo', 'Gera', 'Gomma', 'Guma', 'Kersa', 'Limu Kosa', 'Mana', 'Omo Nada', 'Seka Chekorsa', 'Setema', 'Shebe Senbo', 'Sigmo', 'Sokoru', 'Tiro Afeta'],
      },
      {
        name: 'Kellem Wollega',
        woredas: ['Anfilo', 'Dale Sedi', 'Dale Wabera', 'Gawo Kelle', 'Gidami', 'Hawa Gelan', 'Lalo Kile', 'Sayilem', 'Yemalogi Welele'],
      },
      {
        name: 'Guji',
        woredas: ['Adolana Wadera', 'Anna Sorra', 'Bule Hora', 'Girja', 'Goro Dola', 'Hambela Wamena', 'Kercha', 'Uraga'],
      },
      {
        name: 'Borena',
        woredas: ['Arero', 'Dhas', 'Dire', 'Dillo', 'Guchi', 'Gomole', 'Megalo', 'Miyo', 'Moyale', 'Teltele', 'Wachile', 'Yabelo'],
      },
      {
        name: 'Illubabor',
        woredas: ['Ale', 'Alge Sachi', 'Bedele Zuria', 'Bicho', 'Bure', 'Chora', 'Dabo Hana', 'Dedi', 'Gechi', 'Metu', 'Supena Sodo', 'Yayu'],
      },
    ],
  },
  {
    name: 'Sidama',
    zones: [
      {
        name: 'Sidama',
        woredas: ['Aleta Wendo', 'Arbegona', 'Aroresa', 'Awasa Zuria', 'Bensa', 'Borecha', 'Bursa', 'Chuko', 'Dale', 'Dara', 'Gorche', 'Hula', 'Loka Abaya', 'Malga', 'Shebedino', 'Tulo', 'Wondo Genet'],
      },
      { name: 'Hawassa', woredas: ['Hawassa City'] },
    ],
  },
  {
    name: 'Somali',
    zones: [
      {
        name: 'Sitti',
        woredas: ['Afdem', 'Ayesha', 'Dembel', 'Erer', 'Gabi Rasu', 'Hadhagala', 'Harmukale', 'Shinile'],
      },
      {
        name: 'Fafan',
        woredas: ['Awbare', 'Babile', 'Gursum', 'Harshin', 'Jijiga', 'Kebri Beyah', 'Tuli Guled'],
      },
      {
        name: 'Jijiga',
        woredas: ['Jijiga', 'Kebri Beyah', 'Harshin', 'Tuli Guled'],
      },
      {
        name: 'Nogob',
        woredas: ['Degehabur', 'Gola Odana', 'Gunagado', 'Hamero'],
      },
      {
        name: 'Jarar',
        woredas: ['Araarso', 'Bilcil Bur', 'Degahabur', 'Godey', 'Kabe', 'Yocale'],
      },
      {
        name: 'Dollo',
        woredas: ['Afder', 'Bare', 'Cherati', 'Dolo Odo', 'El Kere', 'Ferfer', 'Helaweyn'],
      },
      {
        name: 'Korahay',
        woredas: ['Debewoyin', 'Kebri Dahar', 'Shilabo', 'Shekosh'],
      },
      {
        name: 'Shebelle',
        woredas: ['Adadle', 'Danan', 'East Imey', 'Ferfer', 'Gode', 'Imey', 'Kelafo', 'Mustahil'],
      },
    ],
  },
  {
    name: 'South Ethiopia',
    zones: [
      {
        name: 'Gofa',
        woredas: ['Demba Gofa', 'Geze Gofa', 'Melokoza', 'Oyda', 'Sawla', 'Uba Debre Tsehay', 'Zala'],
      },
      {
        name: 'Gamo',
        woredas: ['Arba Minch Zuria', 'Bonke', 'Boreda', 'Chencha', 'Daramalo', 'Dita', 'Gacho Baba', 'Geresse', 'Kamba', 'Kemba', 'Loma Bosa'],
      },
      {
        name: 'Wolayita',
        woredas: ['Boloso Bombe', 'Boloso Sore', 'Damot Gale', 'Damot Pulasa', 'Damot Sore', 'Damot Weyde', 'Diguna Fango', 'Humbo', 'Kawo Koysha', 'Kindo Didaye', 'Kindo Koysha', 'Offa', 'Sodo Zuria'],
      },
      {
        name: 'Konso',
        woredas: ['Karat', 'Kena', 'Segan'],
      },
      {
        name: 'Ari',
        woredas: ['Ari', 'Gelila', 'Malle'],
      },
      {
        name: 'Basketo',
        woredas: ['Basketo Special Woreda'],
      },
      {
        name: 'Derashe',
        woredas: ['Derashe Special Woreda'],
      },
    ],
  },
  {
    name: 'South West Ethiopia Peoples',
    zones: [
      {
        name: 'Bench Sheko',
        woredas: ['Bench', 'Debub Bench', 'Sheko', 'Semien Bench'],
      },
      {
        name: 'Dawuro',
        woredas: ['Loma', 'Mareka', 'Tocha', 'Zaba Gazo'],
      },
      {
        name: 'Kaffa',
        woredas: ['Adiyo Kaka', 'Bita', 'Chena', 'Decha', 'Gewata', 'Gimbo', 'Sayilem', 'Telo'],
      },
      {
        name: 'Konta',
        woredas: ['Konta Special Woreda'],
      },
      {
        name: 'Sheka',
        woredas: ['Anderacha', 'Masha', 'Yeki'],
      },
      {
        name: 'West Omo',
        woredas: ['Maji', 'Meinit Goldia', 'Meinit Shasha', 'Surma'],
      },
    ],
  },
  {
    name: 'Tigray',
    zones: [
      {
        name: 'Central',
        woredas: ['Adwa', 'Ahferom', 'Kilte Awulaelo', 'Laelay Maichew', 'Mereb Lehe', 'Naeder Adet', 'Tahtay Maichew', 'Werie Lehe'],
      },
      {
        name: 'Eastern',
        woredas: ['Atsbi Wenberta', 'Erob', 'Ganta Afeshum', 'Gulomahda', 'Hawzen', 'Saesi Tsaedaemba', 'Wukro'],
      },
      {
        name: 'Southern',
        woredas: ['Abergele', 'Alaje', 'Alamata', 'Endamehoni', 'Enderta', 'Mehoni', 'Ofla', 'Raya Azebo', 'Samre', 'Tselemti'],
      },
      {
        name: 'Western',
        woredas: ['Asegede Tsimbela', 'Kafta Humera', 'Kola Tembien', 'Laelay Adiyabo', 'Medebay Zana', 'Tahtay Adiyabo', 'Tsegede', 'Welkait'],
      },
      { name: 'Mekelle', woredas: ['Mekelle City'] },
    ],
  },
];

async function findOrInsert(parentId: number | null, name: string, level: string): Promise<number> {
  const existing = await pool.query(
    `SELECT id FROM locations WHERE level = $1 AND name = $2 AND parent_id IS NOT DISTINCT FROM $3 LIMIT 1`,
    [level, name, parentId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id as number;
  }
  const inserted = await pool.query(
    `INSERT INTO locations (name, level, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, level, parentId]
  );
  return inserted.rows[0].id as number;
}

// Deterministic count for a name so the seed is stable across restarts.
function seededCount(name: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

// Bulk-insert locations (e.g. all kebeles) using ON CONFLICT DO NOTHING so the
// seed stays idempotent, then return a map of "parentId:name" -> location id.
async function bulkInsertLocations(
  rows: { parentId: number; name: string; level: string }[]
): Promise<Map<string, number>> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(', ');
    const params: unknown[] = [];
    chunk.forEach((r) => params.push(r.name, r.parentId, r.level));
    await pool.query(
      `INSERT INTO locations (name, parent_id, level) VALUES ${values} ON CONFLICT (name, parent_id) DO NOTHING`,
      params
    );
  }

  if (rows.length === 0) return new Map();

  const levels = [...new Set(rows.map((r) => r.level))];
  const parents = [...new Set(rows.map((r) => r.parentId))];
  const result = await pool.query(
    `SELECT id, name, parent_id FROM locations WHERE level = ANY($1) AND parent_id = ANY($2)`,
    [levels, parents]
  );
  const map = new Map<string, number>();
  result.rows.forEach((r: any) => map.set(`${r.parent_id}:${r.name}`, r.id as number));
  return map;
}

export async function seedEthiopiaLocations(): Promise<void> {
  const countryId = await findOrInsert(null, 'Ethiopia', 'country');

  const kebeleRows: { parentId: number; name: string; level: string }[] = [];
  const communityRows: { kebeleId: number; name: string }[] = [];

  for (const region of ETHIOPIA_REGIONS) {
    const regionId = await findOrInsert(countryId, region.name, 'region');
    for (const zone of region.zones) {
      const zoneId = await findOrInsert(regionId, zone.name, 'zone');
      for (const woreda of zone.woredas) {
        const woredaId = await findOrInsert(zoneId, woreda, 'woreda');
        const kebeleCount = seededCount(woreda, 10, 20);
        for (let k = 1; k <= kebeleCount; k++) {
          kebeleRows.push({ parentId: woredaId, name: `Kebele ${String(k).padStart(2, '0')}`, level: 'kebele' });
        }
      }
    }
  }

  const kebeleIdByKey = await bulkInsertLocations(kebeleRows);

  for (const k of kebeleRows) {
    const kebeleId = kebeleIdByKey.get(`${k.parentId}:${k.name}`);
    if (!kebeleId) continue;
    const communityCount = seededCount(`${k.parentId}-${k.name}`, 3, 6);
    for (let c = 1; c <= communityCount; c++) {
      communityRows.push({ kebeleId, name: `Community ${c}` });
    }
  }

  for (let i = 0; i < communityRows.length; i += 500) {
    const chunk = communityRows.slice(i, i + 500);
    const values = chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(', ');
    const params: unknown[] = [];
    chunk.forEach((r) => params.push(r.name, r.kebeleId));
    await pool.query(
      `INSERT INTO communities (name, kebele_id) VALUES ${values} ON CONFLICT (name, kebele_id) DO NOTHING`,
      params
    );
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
