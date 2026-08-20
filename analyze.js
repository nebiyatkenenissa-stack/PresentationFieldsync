const fs = require('fs');
const p = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
const c = fs.readFileSync(p, 'utf-8');
const lines = c.split('\n');

let homeStart = -1, homeEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ti = {')) {
    for (let j = i + 1; j < Math.min(i + 200, lines.length); j++) {
      if (lines[j] && lines[j].includes('home: {')) { homeStart = j; break; }
    }
    break;
  }
}
if (homeStart === -1) { console.log('NOT FOUND'); process.exit(1); }

let depth = 0;
for (let i = homeStart; i < lines.length; i++) {
  const line = lines[i] || '';
  for (const ch of line) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0) { homeEnd = i; break; }
}
console.log('Home: ' + (homeStart+1) + '-' + (homeEnd+1));

// Show ONLY the key name for each line for reference
for (let i = homeStart; i <= homeEnd; i++) {
  const line = lines[i];
  if (!line) continue;
  const m = line.match(/^\s+([\w]+):/);
  if (m) {
    console.log('L' + (i+1) + ': ' + m[1]);
  }
}
