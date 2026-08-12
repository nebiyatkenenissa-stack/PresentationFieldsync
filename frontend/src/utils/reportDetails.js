// utils/reportDetails.js
// User-friendly formatting for the verification & screen time metrics
// attached to supervisor reports about field officers.

const fmtMinutes = (m) => {
  const mins = Math.max(0, Math.round(Number(m) || 0));
  const h = Math.floor(mins / 60);
  const min = mins % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

export const levelOf = (score) => (score >= 80 ? 'good' : score >= 50 ? 'medium' : 'low');

// Returns { level, parts } or null when there is nothing to show.
export const verificationDetail = (r) => {
  if (!r || r.type === 'self_report') return null;
  const count = Number(r.verificationCount) || 0;
  if (count <= 0) return null;
  const passed = Number(r.verificationPassed) || 0;
  const score = Number(r.verificationScore) || 0;
  const penalties = Number(r.verificationPenalties) || 0;
  const parts = [`${passed} of ${count} checks passed`, `${score}% score`];
  if (penalties > 0) parts.push(`⚠️ ${penalties} penalty${penalties > 1 ? 'ies' : 'y'}`);
  return { level: levelOf(score), parts };
};

export const screenTimeDetail = (r) => {
  if (!r || r.type === 'self_report') return null;
  const minutes = Number(r.screenTimeMinutes) || 0;
  if (minutes <= 0) return null;
  const trust = Number(r.screenTimeTrustScore) || 0;
  const idle = Number(r.screenTimeIdleMinutes) || 0;
  const parts = [`${fmtMinutes(minutes)} active time`, `Trust ${trust}%`];
  if (idle > 0) parts.push(`${fmtMinutes(idle)} idle`);
  return { level: levelOf(trust), parts };
};
