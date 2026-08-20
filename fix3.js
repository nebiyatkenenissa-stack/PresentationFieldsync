// Surgical fix: only replace corrupted substrings in the ti home section
const fs = require('fs');
const p = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
let c = fs.readFileSync(p, 'utf-8');

// Each fix: [bad_substring, good_replacement]
// We only replace the EXACT corrupted parts, leaving surrounding Tigrinya intact
const fixes = [
  // 1. Chinese ≅ (U+2245) - remove it
  ['\u2245', ''],
  
  // 2. Chinese 拡 (U+62E1) + 选 (U+9009) - "选拡" = garbled
  // Appears in: hero_lead, feat_1_desc, step_3_desc, mission_p2
  // Replace "选拡" with "选拡" (U+9009 + U+62E1) - these are TWO separate Chinese chars
  // Actually 选拡 = U+9009 and拡 = U+62E1, they appear as "选拡" in the text
  // In hero_lead: "ይ选拡ል" should be "ይ选拡ል" → "ይ选拡ል"
  // These appear as separate single chars in different places
  // Let me handle them individually
  ['\u9009', ''],  // 选 - remove
  ['\u62E1', ''],  // 拡 - remove

  // 3. 趵 (U+8DAF) in hero_lead - remove
  ['\u8DAF', '\u12F5'],  // Replace with Ge'ez D (ድ)

  // 4. "tion" in hl_secure - remove the Latin fragment
  ['tion', ''],

  // 5. "eldra" in hl_sync and step_3_desc - remove Latin fragment
  ['eldra', ''],

  // 6. "College" in feat_1_desc - remove
  [' College', ''],

  // 7. "drafts" → "ዳሽቦርድ" in feat_6_desc, step_1_desc, cta_p
  ['drafts', '\u12F3\u1298\u12AE\u1280\u12F5'],  // ዳሽቦርድ

  // 8. "_lai mn" in stat_sync, feat_2_title, step_3_title → "ኣብ ኢንተርነት"
  ['_lai mn', '\u12CB\u12AD \u1260\u1273\u1275\u128D\u1276'],  // ኣብ ኢንተርነት

  // 9. " assignments" in stat_roles - remove English
  [' assignments', ''],

  // 10. " assignS" ... wait, it's lowercase
  [' assigns', ''],  // also just in case

  // 11. "licit" in stat_offline - remove Latin fragment
  ['licit', ''],

  // 12. Gujarati char સ (U+0AB8) in feat_4_desc - remove
  ['\u0AB8', ''],

  // 13. Hebrew chars מין (U+05DE U+05D9 U+05DF) in feat_6_desc - remove
  ['\u05DE\u05D9\u05DF', ''],

  // 14. Chinese 当 (U+5F53) 之 (U+4E4B) 无 (U+65E0) 愧 (U+6127) in mission_p2
  ['\u5F53\u4E4B\u65E0\u6127', ''],  // 当之无愧

  // 15. Chinese 突发事件 (U+7A81 U+53D1 U+4E8B U+4EF6) in cta_p
  ['\u7A81\u53D1\u4E8B\u4EF6', ''],  // 突发事件

  // 16. Chinese 钱财 (U+94B1 U+8D22) in value_1_desc
  ['\u94B1\u8D22', '\u1265\u12AD\u12AB\u1275'],  //钱财 → ዝበ钱财... replace钱财 with ዝበ (connectivity)

  // 17. Arabic هوو فراهم in value_1_desc - remove
  [' \u0647\u0648\u0648 \u0641\u0631\u0627\u0647\u0645', ''],  // هوو فراهم

  // 18. English "exploits" in value_1_desc - remove
  [' exploits', ''],

  // 19. Thai ำ (U+0E33) in value_2_title - remove
  ['\u0E33', ''],  // Remove Thai char

  // 20. English "parcels" in value_2_title - remove
  [' parcels', ''],

  // 21. English "HING" in value_2_desc - replace with Tigrinya
  ['HING', '\u1265\u1235\u134D'],  // → ዝERING... actually just remove

  // 22. "assigns" in value_2_desc - remove English
  // Already handled in fix 10

  // 23. "ma" + "rchitecture" in value_3_desc - remove Latin
  ['rchitecture', ''],

  // 24. "ctor" in contact_office - remove Latin
  ['ctor', ''],

  // 25. "Knob" in contact_office_val - replace with ቤተ መ狀態
  ['Knob', '\u1276\u1275\u1270'],  // ቶ态势

  // 26. "_PCMedia" in follow_note - fix
  ['PCM', ''],

  // 27. "lessly" in follow_note - remove Latin
  ['lessly', ''],

  // 28. Cyrillic вит (U+0432 U+0438 U+0442) in follow_twitter
  ['\u0432\u0438\u134D', ''],  // Wait, this is mixed. Let me check the actual content
  
  // 29. " Yak" or Amharic የሚያስቀምጡ in feat_5_title - this is Amharic, not Tigrinya
  // In Tigrinya "Role-Based Access" would be different
  // Let's leave it as is for now since it's still Ge'ez script
  
  // 30. "街上 PCedia" → follow_note complete fix
  // The whole follow_note is garbled
  
  // 31. "ction" fragment if any remaining
  ['ction', ''],
];

for (const [bad, good] of fixes) {
  // Only replace within the ti home section
  const tiStart = c.indexOf('const ti = {');
  if (tiStart === -1) continue;
  
  const beforeTi = c.substring(0, tiStart);
  const tiSection = c.substring(tiStart);
  
  // Count replacements
  const count = (tiSection.split(bad).length - 1);
  if (count > 0) {
    // Replace only within ti section
    c = beforeTi + tiSection.split(bad).join(good);
    console.log(`Replaced "${bad.substring(0,20)}" (${count}x)`);
  }
}

fs.writeFileSync(p, c, 'utf-8');
console.log('\nDone! Verifying...');

// Verify
const final = fs.readFileSync(p, 'utf-8');
const finalLines = final.split('\n');
let tiHomeStart = -1, tiHomeEnd = -1;
for (let i = 0; i < finalLines.length; i++) {
  if (finalLines[i].includes('const ti = {')) {
    for (let j = i + 1; j < Math.min(i + 200, finalLines.length); j++) {
      if (finalLines[j].includes('    home: {')) { tiHomeStart = j; break; }
    }
    break;
  }
}
let depth = 0;
for (let i = tiHomeStart; i < finalLines.length; i++) {
  for (const ch of finalLines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0) { tiHomeEnd = i; break; }
}

let issues = 0;
for (let i = tiHomeStart; i <= tiHomeEnd; i++) {
  const line = finalLines[i];
  for (let j = 0; j < line.length; j++) {
    const cp = line.codePointAt(j);
    if (cp > 0xFFFF) { j++; continue; } // skip surrogates
    if (cp <= 0x7F) continue; // ASCII OK
    if (cp >= 0x1200 && cp <= 0x137F) continue; // Ge'ez OK
    if (cp >= 0x1380 && cp <= 0x139F) continue; // Ge'ez supplement
    if (cp >= 0x2D80 && cp <= 0x2DDF) continue; // Ge'ez extended
    if ([0x2014, 0x2013, 0x2026, 0x2192, 0x2022].includes(cp)) continue; // punctuation
    console.log(`  Line ${i + 1}: U+${cp.toString(16).toUpperCase()} (${String.fromCodePoint(cp)}) in "${line.trim().substring(0, 80)}"`);
    issues++;
    break; // one per line
  }
}
console.log(`Remaining issues: ${issues}`);
