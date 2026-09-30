// utils/regions.js - Single source of truth for Ethiopia region names.
//
// Charts, analytics and every region dropdown in the app must be labelled with
// a REAL region name (Amhara, Oromia, Addis Ababa, ...) taken from the region
// list, never with a kebele / woreda / zone name.
//
// The list is loaded from the backend (GET /api/locations/level/region, the
// `locations` table seeded in backend/src/models/location.model.ts). If the API
// is unreachable the local FALLBACK_REGIONS copy is used so the app still works
// offline.

import { getApiBase } from '../services/database';

// Mirror of ETHIOPIA_REGIONS in backend/src/models/location.model.ts.
export const FALLBACK_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'South Ethiopia',
  'South West Ethiopia Peoples',
  'Tigray'
];

// Spellings seen in older/imported data mapped onto the canonical region name.
const REGION_ALIASES = {
  'oromiya': 'Oromia',
  'oromia region': 'Oromia',
  'bencishangul': 'Benishangul-Gumuz',
  'benishangul gumuz': 'Benishangul-Gumuz',
  'benishangulgumuz': 'Benishangul-Gumuz',
  'south west ethiopia people': 'South West Ethiopia Peoples',
  'southwest ethiopia peoples': 'South West Ethiopia Peoples',
  'south west peoples': 'South West Ethiopia Peoples',
  'southern nations nationalities and peoples region': 'South Ethiopia',
  'snnpr': 'South Ethiopia',
  'southern': 'South Ethiopia',
  'addis ababa city': 'Addis Ababa',
  'dire dawa city': 'Dire Dawa',
  'amhara region': 'Amhara',
  'tigray region': 'Tigray',
  'somali region': 'Somali',
  'afar region': 'Afar',
  'sidama region': 'Sidama',
  'gambella': 'Gambela',
  'harar': 'Harari'
};

// Old demo data (compass directions) is not a real region.
const LEGACY_REGION_NAMES = ['North', 'South', 'East', 'West', 'Central'];

const squash = (value) => String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');

let cache = null;        // Array<{ id, name }> once loaded
let inflight = null;     // in-flight fetch, so parallel callers share one request

const toList = (raw) => {
  const list = (Array.isArray(raw) ? raw : [])
    .map(item => {
      if (typeof item === 'string') return { id: null, name: item };
      const name = item && (item.name || item.region);
      return name ? { id: item.id != null ? Number(item.id) : null, name: String(name) } : null;
    })
    .filter(Boolean);
  // De-duplicate by canonical key, keeping the first id seen.
  const seen = new Set();
  return list.filter(r => {
    const key = squash(r.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
};

export const fallbackRegionList = () => toList(FALLBACK_REGIONS);

// Synchronous read of the already-loaded list (falls back to the local copy).
export const getRegionList = () => (cache && cache.length ? cache : fallbackRegionList());

// Loads the real region list once and shares the result with every caller.
export const loadRegions = () => {
  if (cache && cache.length) return Promise.resolve(cache);
  if (inflight) return inflight;

  const url = `${getApiBase()}/locations/level/region`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  inflight = fetch(url, controller ? { signal: controller.signal } : undefined)
    .then(res => {
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return res.json();
    })
    .then(data => {
      const list = toList(data);
      if (list.length) cache = list;
      return cache || fallbackRegionList();
    })
    .catch(() => cache || fallbackRegionList())
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      inflight = null;
    });

  return inflight;
};

// Maps any spelling of a region onto the canonical name from the region list.
// Returns null when the value is not a real region (e.g. "Kebele 01").
export const canonicalRegion = (value, regions) => {
  const raw = squash(value);
  if (!raw) return null;
  if (LEGACY_REGION_NAMES.includes(value)) return null;

  const list = regions && regions.length ? regions : getRegionList();
  const found = list.find(r => squash(r.name) === raw);
  if (found) return found.name;
  if (REGION_ALIASES[raw]) return REGION_ALIASES[raw];

  // Path-shaped or prefixed values, e.g. "Amhara > West Gojjam" or "Region: Amhara".
  const segment = raw.split('>').map(s => s.trim()).find(Boolean);
  if (segment) {
    const hit = list.find(r => squash(r.name) === segment);
    if (hit) return hit.name;
  }
  return null;
};

// Splits any stored location string into its hierarchy segments.
export const splitLocationPath = (path) => {
  if (Array.isArray(path)) {
    return path.map(l => (l && typeof l === 'object' ? l.name : l)).filter(Boolean).map(s => String(s).trim());
  }
  if (!path || typeof path !== 'string') return [];
  return path.split('>').map(p => p.trim()).filter(Boolean);
};

// Single canonical hierarchy parser (the old per-page copies disagreed on how
// many segments a path has, which is how kebele names ended up on chart bars).
export const parseLocationHierarchy = (path) => {
  const parts = splitLocationPath(path);
  const h = { country: '', region: '', zone: '', woreda: '', kebele: '', community: '' };
  if (parts.length === 0) return h;
  if (parts.length === 1) { h.region = parts[0]; return h; }
  // Always right-align: Country > Region > Zone > Woreda > Kebele > Community.
  h.community = parts.length > 5 ? parts[parts.length - 1] : '';
  h.kebele = parts.length > 4 ? parts[parts.length - 2] : '';
  h.woreda = parts.length > 3 ? parts[parts.length - 3] : '';
  h.zone = parts.length > 2 ? parts[parts.length - 4] : '';
  h.region = parts.length > 1 ? parts[parts.length - 5] : '';
  h.country = parts.length > 5 ? parts[0] : '';
  return h;
};

// Best available location path for a report / citizen / user record.
export const buildRecordLocationPath = (record) => {
  if (!record) return '';
  if (Array.isArray(record.location_path) && record.location_path.length) {
    const names = record.location_path.map(l => (l && l.name) || '').filter(Boolean);
    if (names.length) return names.join(' > ');
  }
  if (typeof record.locationPath === 'string' && record.locationPath.trim()) return record.locationPath.trim();
  return [record.region, record.district, record.village].filter(Boolean).join(' > ');
};

// The REAL region for a location path. Scans the segments so it works for
// "Amhara", "Ethiopia > Amhara > West Gojjam > Merawi > Kebele 01", etc.
// Returns '' when nothing in the path is a real region, so a kebele name is
// never mistaken for a region.
export const regionOfPath = (path, regions) => {
  const list = regions && regions.length ? regions : getRegionList();
  const parts = splitLocationPath(path);
  for (const part of parts) {
    const canonical = canonicalRegion(part, list);
    if (canonical) return canonical;
  }
  return '';
};

// The real region for a record: prefer the region FK, then the record's own
// location, then the officer's assigned region.
export const regionOfRecord = (record, regions, employeeRegionMap) => {
  if (!record) return '';
  const list = regions && regions.length ? regions : getRegionList();

  if (record.region_id != null) {
    const id = Number(record.region_id);
    const hit = list.find(r => r.id != null && Number(r.id) === id);
    if (hit) return hit.name;
  }

  const own = regionOfPath(buildRecordLocationPath(record), list);
  if (own) return own;

  if (record.registeredBy && employeeRegionMap && employeeRegionMap[record.registeredBy]) {
    return regionOfPath(employeeRegionMap[record.registeredBy], list);
  }
  return '';
};

// Region options for a filter dropdown: the real region list, then any
// region found in the supplied records that is not in it.
export const buildRegionOptions = (extraValues = [], regions) => {
  const list = regions && regions.length ? regions : getRegionList();
  const names = list.map(r => r.name);
  const seen = new Set(names.map(squash));
  extraValues.forEach(value => {
    const canonical = canonicalRegion(value, list);
    if (canonical && !seen.has(squash(canonical))) {
      seen.add(squash(canonical));
      names.push(canonical);
    }
  });
  return names;
};

// Human readable location, always led by the real region name:
// "Amhara · West Gojjam · Merawi". The kebele/community is dropped.
export const describeLocationByRegion = (path, regions) => {
  const h = parseLocationHierarchy(path);
  const region = regionOfPath(path, regions) || h.region;
  return [region, h.zone, h.woreda].filter(Boolean).join(' · ');
};
