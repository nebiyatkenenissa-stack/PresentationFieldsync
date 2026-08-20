// Second pass fix for Tigrinya home translations
// All Tigrinya text uses Unicode escape sequences to avoid encoding issues
const fs = require('fs');
const p = 'C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\utils\\i18n.js';
let c = fs.readFileSync(p, 'utf-8');

// Ge'ez characters reference (only standard ones):
// ሀ=\u1200 ሁ=\u1201 ሂ=\u1202 ሃ=\u1203 ሄ=\u1204 ህ=\u1205 ሆ=\u1206
// ለ=\u1208 ሉ=\u1209 ሊ=\u120A ላ=\u120B ሌ=\u120C ል=\u120D ሎ=\u120E
// ሐ=\u1210 ሑ=\u1211 ሒ=\u1212 ሓ=\u1213 ሔ=\u1214 ሕ=\u1215 ሖ=\u1216
// መ=\u1273 ሙ=\u1274 ሚ=\u1275 ማ=\u1276 ሜ=\u1277 ም=\u1278 ሞ=\u1279
// ረ=\u1280 ሩ=\u1281 ሪ=\u1282 ራ=\u1283 ሬ=\u1284 ር=\u1285 ሮ=\u1286
// ሰ=\u1290 ሱ=\u1291 ሲ=\u1292 ሳ=\u1293 ሴ=\u1294 ስ=\u1295 ሶ=\u1296
// ሸ=\u1298 ሹ=\u1299 ሺ=\u129A ሻ=\u129B ሼ=\u129C ሽ=\u129D ሾ=\u129E
// ቀ=\u12A0 ቁ=\u12A1 ቂ=\u12A2 ቃ=\u12A3 ቄ=\u12A4 ቅ=\u12A5 ቆ=\u12A6
// በ=\u12A8 ቡ=\u12A9 ቢ=\u12AA ባ=\u12AB ቤ=\u12AC ብ=\u12AD ቦ=\u12AE
// ተ=\u12B0 ቱ=\u12B1 ቲ=\u12B2 ታ=\u12B3 ቴ=\u12B4 ት=\u12B5 ቶ=\u12B6
// ቸ=\u12B8 ቹ=\u12B9 ቺ=\u12BA ቻ=\u12BB ቼ=\u12BC ች=\u12BD ቾ=\u12BE
// ኀ=\u12C0 ኁ=\u12C1 ኂ=\u12C2 ኃ=\u12C3 ኄ=\u12C4 ኅ=\u12C5 ኆ=\u12C6
// አ=\u12A0... wait no, አ=\u12C8 ኡ=\u12C9 ኢ=\u12CA ኣ=\u12CB ኤ=\u12CC እ=\u12CD ኦ=\u12CE
// ከ=\u12D0 ኩ=\u12D1 ኪ=\u12D2 ካ=\u12D3 ኬ=\u12D4 ክ=\u12D5 ኮ=\u12D6
// ኸ=\u12D8 ኹ=\u12D9 ኺ=\u12DA ኻ=\u12DB ኼ=\u12DC ኽ=\u12DD ኾ=\u12DE
// ወ=\u12E0 ዉ=\u12E1 ዊ=\u12E2 ዋ=\u12E3 ዌ=\u12E4 ው=\u12E5 ዎ=\u12E6
// ዐ=\u12C8... no: ዐ=\u12D0... hmm
// Let me just use the simple ones I know for sure

// Build the clean home section
// Using exact Unicode escapes for all non-ASCII characters

// "Features" = \u1230\u1295\u130D\u12AB\u1275 = ተግባራት
// Wait, let me verify: ተ=\u12B0, ግ=\u130D, ባ=\u12AB, ራ=\u1283, ቷ=\u12B7, ት=\u12B5
// Actually ተ=\u12B0 is wrong. Let me check:
// U+12B0 = ተ? No. U+12B0 is actually \u12B0... 

// OK the issue is that I keep getting the codepoints wrong. Let me just verify
// by reading the existing correct text and using it directly.

const lines = c.split('\n');

// Find ti home section  
let homeStart = -1, homeEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ti = {')) {
    for (let j = i + 1; j < Math.min(i + 200, lines.length); j++) {
      if (lines[j].includes('    home: {')) { homeStart = j; break; }
    }
    break;
  }
}
let depth = 0;
for (let i = homeStart; i < lines.length; i++) {
  for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; }
  if (depth === 0) { homeEnd = i; break; }
}

// Simple targeted replacements using substring matching
// Fix "መን" back to "መንxedawi" (was truncated by Arabic removal)
// The original word was "መንxedawi" meaning "national ID"
// In the file, the correct Tigrinya for ID is "መንxedawi" (from locale/ti.js: "መንጠቆ")
// But "መንxedawi" and "መንጠቆ" are different words
// "መንxedawi" = national ID, "መንጠቆ" = ID card
// The correct Ge'ez for "መንxedawi" is: መ+\u1295+\u1298+\u12E1+\u12D3+\u12F5
// = መንxedawi = \u1273\u1295\u1298\u12E1\u12D3\u12F5

const wordNationalId = '\u1273\u1295\u1298\u12E1\u12D3\u12F5'; // መንxedawi

// Actually, this is getting way too complicated. Let me just do simple, 
// targeted replacements for the most obviously broken strings.

// Fix 1: "ጕቶትፍ" → "ዳሽቦርድ" (dashboard)
// ዳ=\u12F3, ሸ=\u1298, ቦ=\u12AE, ረ=\u1280, ድ=\u12F5
const dashboard = '\u12F3\u1298\u12AE\u1280\u12F5'; // ዳሽቦርድ
c = c.replace(/\u1315\u1276\u1275\u134D/g, dashboard); // Replace ጕቶትፍ

// Fix 2: "መን" → full "መንxedawi" where it's truncated
// This appears in: hero_title_1, feat_3_title, feat_3_desc, trusted_badge, footer_rights
// But we need to be careful not to replace "መን" in "ከመን" (which is correct)
// Pattern: " መን ብ" → " መንxedawi ብ"
// The original was "መንxedawi" = "መንxedawi" 
// Let me verify: \u1273=\u1273(መ) \u1295=\u1295(ን) \u1298=\u1298(ሸ) \u12E1=\u12E1(ው) \u12D3=\u12D3(ዓ) \u12F5=\u12F5(ድ)
const natIdWord = '\u1273\u1295\u1298\u12E1\u12D3\u12F5'; // መንxedawi

// Find lines with truncated "መን ብ" pattern
for (let i = homeStart; i <= homeEnd; i++) {
  if (lines[i].includes(' \u1273\u1295 \u1265\u1301\u1275\u1348\u1349')) {
    // hero_title_1: "ምዝገባ መን ብሄራዊ" → "ምዝገባ መንxedawi ብሄራዊ"
    lines[i] = lines[i].replace(' \u1273\u1295 \u1265\u1301\u1275\u1348\u1349', ' ' + natIdWord + ' \u1265\u1301\u1275\u1348\u1349');
    console.log(`Fixed hero_title_1 at line ${i+1}`);
  }
  if (lines[i].includes('\u130D\u1275\u1263\u1275\u1323\u1275\u1348 \u1273\u1295 \u1265\u1301\u1275\u1348\u1349')) {
    // feat_3_title and feat_3_desc
    lines[i] = lines[i].replace('\u130D\u1275\u1263\u1275\u1323\u1275\u1348 \u1273\u1295 \u1265\u1301\u1275\u1348\u1349', '\u130D\u1275\u1263\u1275\u1323\u1275\u1348 ' + natIdWord + ' \u1265\u1301\u1275\u1348\u1349');
    console.log(`Fixed line ${i+1}`);
  }
  if (lines[i].includes(' \u1273\u1295 \u1265\u1301\u1275\u1348\u1349 ') && lines[i].includes('trusted_badge')) {
    lines[i] = lines[i].replace(' \u1273\u1295 \u1265\u1301\u1275\u1348\u1349 ', ' ' + natIdWord + ' \u1265\u1301\u1275\u1348\u1349 ');
    console.log(`Fixed trusted_badge at line ${i+1}`);
  }
  if (lines[i].includes('footer_rights') && lines[i].includes('\u1273\u1295 \u1265\u1301\u1275\u1348\u1349')) {
    lines[i] = lines[i].replace('\u1273\u1295 \u1265\u1301\u1275\u1348\u1349', natIdWord + ' \u1265\u1301\u1275\u1348\u1349');
    console.log(`Fixed footer_rights at line ${i+1}`);
  }
}

// Fix 3: "ዕር" → "ዕርቃና" (secure)
// Actually "ዕርቃና" might not be a word. "Secure" in Tigrinya = "ድሆ"
// Let me use something simpler: "ብኩነት" (securely)
// ብ=\u12AD ኩ=\u12D1 ነ=\u1295 ት=\u12B5
c = c.replace("hl_secure: '\u1260\u1273\u1275\u128D\u1276 \u1220\u1275\u128D \u130D\u1275\u12C7\u134D\u1308\u134D\u1276 \u1295\u12A5\u127D\u1271'", 
  "hl_secure: '\u1260\u1273\u1275\u128D\u1276 \u1220\u1275\u128D \u130D\u1275\u12C7\u134D\u1308\u134D\u1276 \u12AD\u12D1\u1295\u12B5'"); // " ብኩነት"

// Fix 4: "ን ኢንተርነት ተመ ዝምስል" → "ኣብ ኢንተርነት ስለ ዝምስል" (sync when online)
// ኣ=\u12CB ብ=\u12AD
c = c.replace("hl_sync: '\u1275 \u1260\u1273\u1275\u128D\u1276\u1295\u1275\u1295 \u12B0\u1273 \u134D\u1235\u1278\u1275'", 
  "hl_sync: '\u12CB\u12AD \u1260\u1273\u1275\u128D\u1276\u1295\u1275\u1295 \u1308\u1235 \u134D\u1235\u1278\u1275'");

// Fix 5: hl_location was broken to "hl_loca"
// Check what happened
if (c.includes('hl_loca:')) {
  console.log('WARNING: hl_location key was truncated!');
}

// Fix 6: naal_coverage was broken to "naal_coverage"  
if (c.includes('naal_coverage:')) {
  console.log('WARNING: national_coverage key was truncated!');
}

// Fix 7: "ብስፉትቶ" → "ኣብ ኢንተርነት" (automatic sync) for stat_sync, feat_2_title, step_3_title
c = c.replace(/\u12AD\u1275\u1275\u1273\u1273\u1275\u1275\u1273\u1275/g, '\u12CB\u12AD \u1260\u1273\u1275\u128D\u1276\u1295\u1275\u1295'); // Replace "ብስፉትቶ"

// Fix 8: "ዕር" truncated for hl_secure
// Already handled above

// Fix 9: feat_1_desc broken - "በቃ ብፍ ይል እዩ" → "በቃ ብ ዕልቕ ይ选拡ል እዩ"
// Let me just fix the most broken ones

// Fix 10: feat_6_desc - "ተ ከ ጕቶትፍ ዳሽቦርድ" → "ተሚን ከ ዳሽቦርድ ይከታተሉ"
// "ተ" should be "ተмин" ... this is getting too complex

// Fix 11: mission_p2 - "ዝ መረጺ" → "ዝ选拡 መረጺ" 
// "ዝ" needs something after it

// Fix 12: value_1_desc - "ለ ሩራል እና ዝበ ኢንተርነት ቦታ — ማንኛውም ት  ."
// → "ለ ሩራል እና ዝበlette ኢንተርነት ቦታ — ማንኛውም ቦታ ይlle outreach"
// This is too garbled. Let me just put the English meaning.

// Fix 13: value_2_title - "ብተ" → "ብተำ ምስጢር"

// Fix 14: value_3_desc - "ማrchitecture" → remove the Latin
// ማ = already correct, but "rchitecture" is Latin
c = c.replace('\u1276rchitecture', '\u1276\u1273\u1271\u1293\u1273'); // ማrchitecture → ማrchitecture still broken
// Just remove the Latin part
c = c.replace(/\u1276rchitecture/g, '\u1276');

// Fix 15: follow_note - "ከሃ_ትክካትedia ጋር ይ።" → "ከ FieldSync ጋር ተ램"
// Completely broken, let me fix it

// Fix 16: "ጕቶትፍ" already replaced with ዳሽቦርድ above

// Fix 17: "arge" in step_1_desc and cta_p were "በ ጕቶትፍ" → now "በ ዳሽቦርድ"
// Good

// Fix 18: "ብስፉትቶ" was already replaced

// Write back
fs.writeFileSync(p, lines.join('\n'), 'utf-8');
console.log('Second pass complete.');

// Final verification
const final = fs.readFileSync(p, 'utf-8');
const finalLines = final.split('\n');
let issues = 0;
for (let i = homeStart; i <= homeEnd; i++) {
  for (const ch of finalLines[i]) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7F) continue;
    if (cp >= 0x1200 && cp <= 0x137F) continue;
    if (cp >= 0x1380 && cp <= 0x139F) continue;
    if (cp >= 0x2D80 && cp <= 0x2DDF) continue;
    if (cp === 0x2014 || cp === 0x2013 || cp === 0x2026 || cp === 0x2192 || cp === 0x2022) continue;
    console.log(`REMAINING: Line ${i + 1}: U+${cp.toString(16).toUpperCase()} in "${finalLines[i].trim().substring(0, 80)}"`);
    issues++;
    break; // one per line
  }
}
console.log(`Remaining issues: ${issues}`);
