// Step 1: Extract all unique Ge'ez codepoints from the existing ti block
const fs = require('fs');
const p = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
const c = fs.readFileSync(p, 'utf-8');
const lines = c.split('\n');

// Find ti block boundaries
let tiStart = -1, tiEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ti = {')) { tiStart = i; break; }
}
if (tiStart === -1) { console.error('ti not found'); process.exit(1); }

let depth = 0;
for (let i = tiStart; i < lines.length; i++) {
  const line = lines[i] || '';
  for (const ch of line) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0 && i > tiStart) { tiEnd = i; break; }
}

console.log('ti block: lines ' + (tiStart+1) + '-' + (tiEnd+1));

// Also find English home section boundaries
let enHomeStart = -1, enHomeEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const en = {')) {
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes('home: {')) { enHomeStart = j; break; }
    }
    break;
  }
}
depth = 0;
for (let i = enHomeStart; i < lines.length; i++) {
  const line = lines[i] || '';
  for (const ch of line) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0 && i > enHomeStart) { enHomeEnd = i; break; }
}

console.log('en home: lines ' + (enHomeStart+1) + '-' + (enHomeEnd+1));

// Extract all unique Ge'ez chars from ti block
const geEzChars = new Map();
const tiBlock = lines.slice(tiStart, tiEnd + 1).join('\n');
for (const ch of tiBlock) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x1200 && cp <= 0x137F && !geEzChars.has(ch)) {
    geEzChars.set(ch, '\\u' + cp.toString(16).padStart(4, '0'));
  }
}

console.log('\nUnique Ge\'ez chars in ti block: ' + geEzChars.size);
// Print sorted by codepoint
for (const [ch, hex] of [...geEzChars.entries()].sort((a,b) => a[1].localeCompare(b[1]))) {
  console.log('  ' + hex + ' = ' + ch);
}

// Also extract the English home section keys and values
console.log('\nEnglish home keys:');
for (let i = enHomeStart; i <= enHomeEnd; i++) {
  const m = lines[i].match(/^\s+([\w_]+):\s*['"`](.+?)['"`]/);
  if (m) console.log('  ' + m[1] + ': ' + m[2].substring(0, 60));
}
