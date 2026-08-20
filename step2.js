const fs = require('fs');
const p = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
const c = fs.readFileSync(p, 'utf-8');

// Find ti block end
const tiStart = c.indexOf('const ti = {');
const lines = c.split('\n');
let tiEndLine = -1;
let tiLineStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ti = {')) { tiLineStart = i; break; }
}
let depth = 0;
for (let i = tiLineStart; i < lines.length; i++) {
  const l = lines[i] || '';
  for (const ch of l) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0 && i > tiLineStart) { tiEndLine = i; break; }
}

// Build clean home section using Unicode escapes that match the EXACT codepoints
// found in the existing ti block

const homeSection = [
  "    home: {",
  "      nav_features: '\u1270\u1295\u130D\u12AB\u1275',",
  "      nav_how: '\u1235\u1275\u12CD \u1265\u1270 \u1265\u1235\u122D\u1235',",
  "      nav_about: '\u1308\u1235 \u1275\u1233\u1273\u127D\u1276',",
  "      nav_contact: '\u12A0\u12CD\u1295',",
  "      sign_in: '\u1260\u1273',",
  "      online_badge: '\u1370\u1228\u1295\u1275\u12AB \u1260\u124D\u1293\u12F5 \u2014 \u130D\u130D\u134D\u1235 \u1240\u1273',",
  "      offline_badge: '\u1260\u124D\u1293\u12F5 \u12AB\u1275\u1349\u1275 \u2014 \u1271\u1276\u1235 \u1265\u12AB\u1293\u1275 \u1349\u1275\u1233\u1275',",
];
