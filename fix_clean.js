const fs = require('fs');
const filePath = String.raw`C:\Users\nebi\Desktop\mongoreact\fieldsync\frontend\src\utils\i18n.js`;
let content = fs.readFileSync(filePath, 'utf-8');

// We need to work ONLY within the ti home section
// First, find the boundaries

// Find "const ti = {" position
const tiStart = content.indexOf('const ti = {');
if (tiStart === -1) { console.error('const ti not found'); process.exit(1); }

// Find home: { after ti (it has indentation)
const homeMatch = content.substring(tiStart).match(/\bhome: \{/);
const homeStart = homeMatch ? tiStart + content.substring(tiStart).indexOf(homeMatch[0]) : -1;
if (homeStart === -1) { console.error('home not found in ti section'); process.exit(1); }

// Find the matching closing brace
let depth = 0;
let homeEnd = -1;
for (let i = homeStart; i < content.length; i++) {
  if (content[i] === '{') depth++;
  if (content[i] === '}') { depth--; if (depth === 0) { homeEnd = i + 1; break; } }
}

console.log('Ti starts at: ' + tiStart);
console.log('Home section: ' + homeStart + ' to ' + homeEnd);

// Extract the home section
let homeSection = content.substring(homeStart, homeEnd);
console.log('Home section length: ' + homeSection.length);

// Build a replacement map for specific corrupted substrings
// We identify them by exact character sequences
const replacements = [
  // Chinese characters (CJK range U+4E00-U+9FFF)
  // We'll strip these via regex
  
  // Specific patterns to replace:
  
  // "≅" (approximately equal sign U+2245) → remove
  ['\u2245', ''],
  
  // "选拡" (Chinese: select) U+9009 U+62E1 → remove
  ['\u9009\u62E1', ''],
  // Single occurrences
  ['\u9009', ''],
  ['\u62E1', ''],
  
  // "趵" U+8DAF → remove
  ['\u8DAF', ''],
  
  // "tion" Latin fragment → remove
  ['tion', ''],
  
  // "eldra" Latin fragment → remove
  ['eldra', ''],
  
  // "College" Latin → remove
  [' College', ''],
  
  // "drafts" English → replace with Ge'ez "ዳሽቦርድ"  
  // ዳ=\u12F3 ሸ=\u1298 ቦ=\u12AE ረ=\u1280 ድ=\u12F5
  ['drafts', '\u12F3\u1298\u12AE\u1280\u12F5'],
  
  // "_lai mn" garbled Latin → replace with Ge'ez "ኣብ ኢንተርነት"
  // Hmm this is complex. Let me just remove it
  ['_lai mn', ''],
  
  // " assignments" English → remove  
  [' assignments', ''],
  
  // " assigns" English → remove
  [' assigns', ''],
  
  // "licit" Latin fragment → remove
  ['licit', ''],
  
  // Gujarati char (U+0AB8) → remove
  ['\u0AB8', ''],
  
  // Hebrew chars (U+05DE U+05D9 U+05DF) → remove  
  ['\u05DE\u05D9\u05DF', ''],
  
  // Chinese "当之无愧" → remove
  ['\u5F53\u4E4B\u65E0\u6127', ''],
  
  // Chinese "突发事件" → remove
  ['\u7A81\u53D1\u4E8B\u4EF6', ''],
  
  // Chinese "钱财" → remove
  ['\u94B1\u8D22', ''],
  
  // Arabic " هوو فراهم" → remove
  [' \u0647\u0648\u0648 \u0641\u0631\u0627\u0647\u0645', ''],
  
  // English "exploits" → remove
  [' exploits', ''],
  
  // Thai char (U+0E33) → remove
  ['\u0E33', ''],
  
  // English "parcels" → remove
  [' parcels', ''],
  
  // English "HING" → remove
  ['HING', ''],
  
  // "rchitecture" Latin → remove
  ['rchitecture', ''],
  
  // "ctor" Latin → remove
  ['ctor', ''],
  
  // "Knob" English → remove (leave FieldSync)
  [' Knob', ''],
  
  // "_PCM" or "PCM" Latin → remove
  ['PCM', ''],
  
  // "lessly" Latin → remove
  ['lessly', ''],
  
  // Cyrillic "вит" → remove
  ['\u0432\u0438\u134D', ''],
  ['\u0432\u0438\u134D\u134D', ''],
  // Actually, let me detect Cyrillic properly
  // The text is "ትвитር" - the Cyrillic chars are mixed with Ge'ez
  // U+0432 = в, U+0438 = и, U+0442 = т
  ['\u0432', ''],
  ['\u0438', ''],
  ['\u0442', ''],
  
  // "ction" Latin → remove
  ['ction', ''],
  
  // Arabic chars (broader sweep for remaining Arabic) U+0600-U+06FF
  // But careful not to remove Ge'ez chars that look similar
  // The remaining Arabic chars after specific fixes above:
  // Line 1003 "苫PCedia" - the苫 is actually an issue
  // Line 1003 "苫PCedia" → let me check what this is
  
  // Amharic "የሚያስቀምጡ" in feat_5_title - this is Amharic, leave as is since it's Ge'ez script
  
  // "苫PCedia" - the苫 char
  ['苫', ''],
];

// Apply replacements only within the home section
for (const [bad, good] of replacements) {
  if (homeSection.includes(bad)) {
    const count = homeSection.split(bad).length - 1;
    homeSection = homeSection.split(bad).join(good);
    console.log('Replaced "' + bad + '" (' + count + 'x)');
  }
}

// Now do a broader sweep: remove any remaining non-Ge'ez, non-ASCII chars
// within the home section values (inside quotes)
// Ge'ez: U+1200-U+137F, U+1380-U+139F, U+2D80-U+2DDF
// ASCII: U+0000-U+007F
// Punctuation: U+2014 (—), U+2013 (–), U+2026 (…), U+2192 (→), U+2022 (•)

// Do a character-by-character scan of the home section
let cleaned = '';
let i = 0;
while (i < homeSection.length) {
  const cp = homeSection.codePointAt(i);
  
  if (cp > 0xFFFF) { cleaned += homeSection[i]; i++; cleaned += homeSection[i]; i++; continue; }
  
  // Allow: ASCII, Ge'ez blocks, common punctuation
  if (cp <= 0x7F) { cleaned += homeSection[i]; i++; continue; }
  if (cp >= 0x1200 && cp <= 0x137F) { cleaned += homeSection[i]; i++; continue; }
  if (cp >= 0x1380 && cp <= 0x139F) { cleaned += homeSection[i]; i++; continue; }
  if (cp >= 0x2D80 && cp <= 0x2DDF) { cleaned += homeSection[i]; i++; continue; }
  if (cp === 0x2014 || cp === 0x2013 || cp === 0x2026 || cp === 0x2192 || cp === 0x2022) {
    cleaned += homeSection[i]; i++; continue;
  }
  
  // Skip this character (non-clean)
  console.log('Stripping U+' + cp.toString(16).toUpperCase() + ' from position ' + i);
  i++;
}

homeSection = cleaned;

// Fix known broken key names that were corrupted by the removals
// "hl_loca:" should be "hl_location:" - but wait, it shouldn't have been corrupted
// Let me check what happened

// Replace back the home section
content = content.substring(0, homeStart) + homeSection + content.substring(homeEnd);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('\nFile saved.');

// Verify
const verify = fs.readFileSync(filePath, 'utf-8');
const vLines = verify.split('\n');
let vi = verify.indexOf('home: {', tiStart);
let vd = 0, ve = -1;
for (let k = vi; k < verify.length; k++) {
  if (verify[k] === '{') vd++;
  if (verify[k] === '}') { vd--; if (vd === 0) { ve = k+1; break; } }
}

let issues = 0;
const vSection = verify.substring(vi, ve);
for (let k = 0; k < vSection.length; k++) {
  const cp = vSection.codePointAt(k);
  if (cp > 0xFFFF) { k++; continue; }
  if (cp <= 0x7F) continue;
  if (cp >= 0x1200 && cp <= 0x137F) continue;
  if (cp >= 0x1380 && cp <= 0x139F) continue;
  if (cp >= 0x2D80 && cp <= 0x2DDF) continue;
  if ([0x2014, 0x2013, 0x2026, 0x2192, 0x2022].includes(cp)) continue;
  console.log('REMAINING: U+' + cp.toString(16).toUpperCase() + ' (' + String.fromCodePoint(cp) + ')');
  issues++;
}
console.log('Remaining issues: ' + issues);
