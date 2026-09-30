import toast from 'react-hot-toast';
// utils/helpers.js - Complete fixed version
import { buildRegionOptions } from './regions';


export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ===== STRUCTURED NATIONAL ID (with checksum) =====
// Format: ET-<birthYearYY>-<regionCode>-<sequence5>-<check>
// e.g. ET-26-AM-00017-4  →  Ethiopian national ID, region Amhara,
//                           birth year 2026, sequence 00017, check 4.
// The sequence + year + region index are protected by a Luhn check digit so
// typos and transcription errors are detected automatically.
const REGION_CODES = [
  ['ADDIS ABABA', 'AA'],
  ['AFAR', 'AF'],
  ['AMHARA', 'AM'],
  ['BENISHANGUL', 'BG'],
  ['DIRE DAWA', 'DD'],
  ['GAMBELA', 'GA'],
  ['HARARI', 'HA'],
  ['OROMIA', 'OR'],
  ['OROMIYA', 'OR'],
  ['SIDAMA', 'SD'],
  ['SOMALI', 'SO'],
  ['SOUTH WEST', 'SW'],
  ['SOUTHERN', 'SN'],
  ['SOUTHERN NATIONS', 'SN'],
  ['SNNPR', 'SN'],
  ['TIGRAY', 'TG'],
  ['NORTH', 'NO'],
  ['SOUTH', 'SO'],
  ['EAST', 'EA'],
  ['WEST', 'WE'],
  ['CENTRAL', 'CE']
];

// 2-letter code for a region name (unknown → XX).
export const getRegionCode = (region = '') => {
  const r = String(region || '').trim().toUpperCase();
  if (!r) return 'XX';
  for (const [name, code] of REGION_CODES) {
    if (r.includes(name)) return code;
  }
  return r.replace(/[^A-Z]/g, '').slice(0, 2) || 'XX';
};

// Standard Luhn check digit for a digit string (0–9).
const luhnCheckDigit = (digits) => {
  const reversed = String(digits).split('').reverse();
  let sum = 0;
  reversed.forEach((ch, i) => {
    let d = Number(ch);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return (10 - (sum % 10)) % 10;
};

// Canonical order of region codes → gives the 2-digit region index embedded in
// the ID. It is derived from the printed code (not the input name) so the Luhn
// check digit can be verified from the ID alone.
export const REGION_CODE_ORDER = ['AA', 'AF', 'AM', 'BG', 'DD', 'GA', 'HA', 'OR', 'SD', 'SO', 'SW', 'SN', 'TG', 'NO', 'EA', 'WE', 'CE'];

// Verifies an ET-<YY>-<REG>-<seq>-<check> national ID (typos/transcriptions).
export const isValidNationalId = (nationalId) => {
  const m = String(nationalId || '').trim().match(/^ET-(\d{2})-([A-Z]{2})-(\d{5})-(\d)$/);
  if (!m) return false;
  const regionIndex = String(Math.max(REGION_CODE_ORDER.indexOf(m[2]), 0)).padStart(2, '0');
  return luhnCheckDigit(`${m[1]}${regionIndex}${m[3]}`) === Number(m[4]);
};

export const generateNationalId = ({ region = '', dateOfBirth = null } = {}) => {
  const regionCode = getRegionCode(region);
  const birthYear = dateOfBirth ? String(new Date(dateOfBirth).getFullYear()).slice(-2)
    : String(new Date().getFullYear()).slice(-2);
  const regionIndex = String(Math.max(REGION_CODE_ORDER.indexOf(regionCode), 0)).padStart(2, '0');
  const sequence = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  const check = luhnCheckDigit(`${birthYear}${regionIndex}${sequence}`);
  return `ET-${birthYear}-${regionCode}-${sequence}-${check}`;
};

export const getToday = () => new Date().toISOString().slice(0, 10);

// Resolve the server origin (no /api suffix) so uploaded profile photos load
// correctly both on localhost and from other devices on the same network.
const API_PORT = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_PORT)
  || '5000';

export const getServerBase = () => {
  try {
    if (typeof window === 'undefined' || !window.location) return `http://localhost:${API_PORT}`;
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return `http://localhost:${API_PORT}`;
    }
    return `http://${hostname}:${API_PORT}`;
  } catch (e) {
    return `http://localhost:${API_PORT}`;
  }
};

// Full URL for an uploaded profile photo path (e.g. '/uploads/abc.jpg').
// Passes through full URLs and base64 data URLs unchanged, otherwise prefixes
// the server origin so relative /uploads/... paths resolve to the API host.
// Returns null when there is no photo so callers can show a fallback avatar.
export const getProfilePhotoUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('blob:')) return path;
  return `${getServerBase()}${path}`;
};

// Region options for a filter dropdown. Returns ['All', ...realRegionNames] where
// the names come from the real region list (utils/regions.js) and any region
// found in the supplied users list. Kebele / woreda / zone values are never
// offered as regions.
export const getRegionOptions = (users, regions) => {
  const raw = (users || [])
    .map(u => u && u.region)
    .filter(r => r && r !== 'All' && r !== 'all' && r !== '');
  return ['All', ...buildRegionOptions(raw, regions)];
};

// Map each employeeId to the region listed for that user.
export const getEmployeeRegionMap = (users) => {
  const map = {};
  (users || []).forEach(u => {
    if (u && u.employeeId && u.region && u.region !== 'All' && u.region !== 'all') {
      map[u.employeeId] = u.region;
    }
  });
  return map;
};


export const getCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

// Format a timestamp (Date, ISO string, or epoch ms) as HH:MM (24h).
export const formatTimeOfDay = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

export const formatTime = (seconds) => {
  // FIX: Guard against ALL invalid values
  if (seconds === undefined || seconds === null) return '00:00:00';
  if (typeof seconds === 'string') seconds = parseInt(seconds);
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds)) return '00:00:00';
  if (seconds < 0) return '00:00:00';
  if (seconds > 86400) seconds = 86400; // Cap at 24 hours max display
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const fakeSyncApi = (report) => {
  return new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      reject(new Error('You are offline. Please connect to the internet.'));
      return;
    }
    
    const delay = 500 + Math.random() * 1000;
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error('Network error - sync failed'));
      } else {
        resolve({ ...report, synced: true, syncDate: new Date().toISOString() });
      }
    }, delay);
  });
};

export const exportCSV = (data, filename) => {
  if (!data || data.length === 0) { 
    toast('No data to export'); 
    return; 
  }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','), 
    ...data.map(row => headers.map(h => `"${row[h] != null ? row[h] : ''}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const convertTo12Hour = (timeStr) => {
  if (!timeStr || timeStr === 'N/A') return '--:--';
  try {
    // Handle ISO date strings
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return '--:--';
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
    
    // Handle time strings like "08:00" or "17:00:00"
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    
    if (isNaN(hours)) return timeStr;
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch (error) {
    return timeStr || '--:--';
  }
};