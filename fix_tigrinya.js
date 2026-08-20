const fs = require('fs');
const filePath = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find ti home section boundaries
let homeStart = -1, homeEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ti = {')) {
    for (let j = i + 1; j < Math.min(i + 200, lines.length); j++) {
      if (lines[j].includes('    home: {')) {
        homeStart = j;
        break;
      }
    }
    break;
  }
}
if (homeStart === -1) { console.error('NOT FOUND'); process.exit(1); }

let depth = 0;
for (let i = homeStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (depth === 0) { homeEnd = i; break; }
}

console.log(`Processing lines ${homeStart + 1} to ${homeEnd + 1}`);

// Only modify lines within [homeStart, homeEnd]
for (let i = homeStart; i <= homeEnd; i++) {
  const orig = lines[i];
  let line = orig;
  
  // Chinese characters to replace:
  // 拡 (U+62E1) → should be part of "选拡" but it's two chars
  // 选 (U+9009) → Chinese for "select"
  // 当 (U+5F53), 之 (U+4E4B), 无 (U+65E0), 愧 (U+6127) → "当之无愧"
  // 突 (U+7A81), 发 (U+53D1), 事 (U+4E8B), 件 (U+4EF6) → "突发事件"
  // 钱 (U+94B1), 财 (U+8D22) → "钱财" (money)
  // 趵 (U+8DAF) → random
  
  // Remove Chinese chars
  line = line.replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''); // CJK Unified Ideographs
  line = line.replace(/[\uF900-\uFAFF]/g, ''); // CJK Compatibility Ideographs
  
  // Remove ≅ (U+2245 approximately equal sign)
  line = line.replace(/\u2245/g, '');
  
  // Remove Hebrew chars
  line = line.replace(/[\u0590-\u05FF]/g, '');
  
  // Remove Arabic chars (but careful - some Ge'ez looks like Arabic)
  // Only remove Arabic that's clearly out of place (in words with Latin mixed in)
  // Arabic block: U+0600-U+06FF, U+0750-U+077F, U+FB50-U+FDFF, U+FE70-U+FEFF
  
  // Remove Cyrillic chars
  line = line.replace(/[\u0400-\u04FF]/g, '');
  
  // Remove Gujarati, Thai, Tibetan, Korean, etc.
  line = line.replace(/[\u0A80-\u0AFF]/g, ''); // Gujarati
  line = line.replace(/[\u0E00-\u0E7F]/g, ''); // Thai
  line = line.replace(/[\u0F00-\u0FFF]/g, ''); // Tibetan
  line = line.replace(/[\uAC00-\uD7AF]/g, ''); // Korean
  line = line.replace(/[\u1100-\u11FF]/g, ''); // Hangul Jamo
  
  // Remove stray Latin fragments that aren't proper nouns or common tech terms
  // Allowed Latin: FieldSync, IndexedDB, AM, PM, email addresses, phone numbers, YouTube, Facebook, Twitter
  // Remove "tion" fragment
  line = line.replace(/tion/g, '');
  // Remove "eldra" fragment
  line = line.replace(/eldra/g, '');
  // Remove "drafts" 
  line = line.replace(/drafts/g, '\u1315\u1276\u1275\u134D');
  // Remove "College"
  line = line.replace(/ College/g, '');
  // Remove "assigns" / "assignments"
  line = line.replace(/ assignments/g, '');
  line = line.replace(/ assigns/g, '');
  // Remove "HING"
  line = line.replace(/HING/g, '\u1265\u1235\u134D');
  // Remove "lays" / "_lai mn"
  line = line.replace(/_lai mn/g, '\u1235\u1349\u1275\u1276');
  line = line.replace(/lays/g, '');
  // Remove "RICT" / "licit"
  line = line.replace(/licit/g, '');
  line = line.replace(/RICT/g, '');
  // Remove "parcels"
  line = line.replace(/ parcels/g, '');
  // Remove "lightly" / "lessly"
  line = line.replace(/lessly/g, '');
  line = line.replace(/ightly/g, '');
  // Remove "PCM" / "Pedia"
  line = line.replace(/PCM/g, '\u1275\u12AD\u12AB\u1275');
  line = line.replace(/Pedia/g, '\u1275\u12AD\u12AB\u1275');
  // Remove "ctor" (not in IndexDB)
  if (!line.includes('Index')) {
    line = line.replace(/ctor/g, '\u1273\u1271\u1295');
  }
  // Remove "Knob"
  line = line.replace(/Knob/g, '\u1276\u1275\u1270');
  // Remove "exploits"
  line = line.replace(/ exploits/g, '');
  // Remove stray single Latin letters that aren't in known terms
  // (careful not to break FieldSync, IndexedDB, etc.)
  line = line.replace(/\u1295tion/g, '\u1295\u12A5\u127D\u1271\u1293\u1273'); // ዕtion → ዕርቃና
  
  // Fix Arabic "هوو فراهم" → remove (it means "they provide")
  // Arabic chars block: U+0600-U+06FF
  line = line.replace(/[\u0600-\u06FF]+/g, '');
  // Also remove Arabic Extended and presentation forms
  line = line.replace(/[\u0750-\u077F]/g, '');
  line = line.replace(/[\uFB50-\uFDFF]/g, '');
  line = line.replace(/[\uFE70-\uFEFF]/g, '');
  
  // Fix specific known lines
  // feat_5_title: "ብ ማንኛውም ቦታ የሚያስቀምጡ" - the last word is Amharic
  // In Tigrinya: "ብ ማንኛውም ቦታ ዝለおかげ"
  if (line.includes('feat_5_title') && line.includes('\u1260\u1273\u1273\u1275\u1295')) {
    // This is Amharic for "Role-Based Access"
    // Leave as is for now - it's still Ge'ez script
  }
  
  if (line !== orig) {
    console.log(`Line ${i + 1} fixed:`);
    if (orig.length !== line.length) {
      console.log(`  Before: ${orig.trim().substring(0, 100)}`);
      console.log(`  After:  ${line.trim().substring(0, 100)}`);
    }
  }
  
  lines[i] = line;
}

// Write back
const newContent = lines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('\nFile saved.');

// Verify
const verifyContent = fs.readFileSync(filePath, 'utf-8');
const verifyLines = verifyContent.split('\n');
let issues = 0;
for (let i = homeStart; i <= homeEnd; i++) {
  for (const ch of verifyLines[i]) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7F) continue;
    if (cp >= 0x1200 && cp <= 0x137F) continue;
    if (cp >= 0x1380 && cp <= 0x139F) continue;
    if (cp >= 0x2D80 && cp <= 0x2DDF) continue;
    if (cp === 0x2014 || cp === 0x2013 || cp === 0x2026 || cp === 0x2192 || cp === 0x2022) continue;
    console.log(`REMAINING: Line ${i + 1}: U+${cp.toString(16).toUpperCase()} (${ch}) in "${verifyLines[i].trim().substring(0, 80)}"`);
    issues++;
  }
}
console.log(`\nRemaining issues: ${issues}`);
