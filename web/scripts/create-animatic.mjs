// Code-authored, replaceable pose drawings. These are animatic art, not final animation.
// Pilot crops are authorized temporary reference crops. Originals remain byte-for-byte intact.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const root = new URL('../source-art/legacy-animatic/', import.meta.url);
await mkdir(root, { recursive: true });
const poly = (points, fill, stroke = '#111c2c', width = 2) =>
  '<polygon points="' + points + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + width + '" stroke-linejoin="round"/>';
const path = (d, stroke, width = 2) => '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + width + '"/>';
const group = (transform, content) => '<g transform="' + transform + '">' + content + '</g>';
const poses = {
  idle:    { body: -4, la: 9, ra: -12, ll: 4, rl: -9, knee: 5, blade: false },
  ready:   { body: 9, la: 48, ra: -142, ll: 16, rl: -32, knee: 36, blade: true },
  dash:    { body: 40, la: 58, ra: -104, ll: 48, rl: -48, knee: 64, blade: true },
  fire:    { body: 2, la: -32, ra: -88, ll: 12, rl: -25, knee: 24, blade: false },
  strike:  { body: 25, la: 82, ra: -52, ll: 35, rl: -50, knee: 30, blade: true },
  hit:     { body: -26, la: 58, ra: -36, ll: -26, rl: 25, knee: 46, blade: false },
  recover: { body: -12, la: 18, ra: -24, ll: 13, rl: -17, knee: 20, blade: false },
};
function mech(unit, pose) {
  const rival = unit === 'rival';
  const p = poses[pose];
  const main = rival ? '#343945' : '#e8eef4';
  const light = rival ? '#616572' : '#ffffff';
  const shadow = rival ? '#151b28' : '#8eabc3';
  const blue = rival ? '#232734' : '#244976';
  const glow = rival ? '#ff4769' : '#7cf5f0';
  const trim = rival ? '#92354a' : '#d8b878';
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="680" height="780" viewBox="0 0 680 780">';
  s += '<defs><linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + light + '"/><stop offset=".42" stop-color="' + main + '"/><stop offset="1" stop-color="' + shadow + '"/></linearGradient><linearGradient id="steel"><stop stop-color="#091222"/><stop offset=".5" stop-color="#47576d"/><stop offset="1" stop-color="#142132"/></linearGradient></defs>';
  let body = '';
  // Long, swept rear binders; silhouette is intentionally different for the rival.
  body += poly(rival ? '225,260 159,32 223,98 282,300' : '232,275 177,78 225,112 280,288', blue);
  body += poly(rival ? '383,273 479,13 457,231 414,415' : '380,270 450,68 451,288 416,409', shadow);
  body += poly(rival ? '440,78 463,35 448,231 415,359' : '430,116 444,91 435,276 405,337', main);
  body += path('M 201 115 L 252 272 M 447 107 L 422 276', glow, 3);
  // Pelvis and separately articulated legs.
  const leg = (angle, bent, near) => {
    let l = poly('-24,0 27,0 36,83 19,108 -20,101 -32,61', 'url(#armor)');
    l += poly('-20,12 19,15 17,74 -10,82', main);
    l += path('M -20 34 L 19 38 M -8 24 L -4 64', shadow, 2);
    l += '<circle cx="2" cy="107" r="20" fill="url(#steel)" stroke="#080e1a" stroke-width="3"/>';
    let shin = poly('-28,0 29,-4 39,37 20,141 -27,141 -38,66', 'url(#armor)');
    shin += poly('-28,13 10,8 14,80 -4,113 -27,100', main);
    shin += poly('16,19 30,31 14,131 -2,132 4,80', shadow);
    shin += poly('-21,4 22,0 17,31 -13,38', blue);
    shin += path('M -22 57 L -9 62 L -10 91 M -26 109 L -4 115', blue, 2);
    shin += poly('-28,130 19,128 36,160 20,176 -45,174 -55,161', blue);
    shin += poly('-26,134 10,134 19,156 -40,157', main);
    shin += path('M -43 166 L 22 166', glow, 2);
    l += group('translate(1 112) rotate(' + bent + ')', shin);
    return group('translate(' + (near ? 340 : 275) + ' 379) rotate(' + angle + ')', l);
  };
  body += leg(p.ll, p.knee, false);
  body += leg(p.rl, -p.knee * .28, true);
  body += poly('265,327 341,325 366,370 334,404 276,402 250,368', 'url(#steel)');
  body += poly('252,330 302,345 284,412 242,400', 'url(#armor)');
  body += poly('312,345 360,331 380,403 330,415', 'url(#armor)');
  body += poly('294,345 318,343 327,378 299,387 283,371', rival ? trim : '#ae3e45');
  body += path('M 252 353 L 281 363 M 333 362 L 364 349', shadow, 3);
  // Far arm, torso, near arm.
  const arm = (x, y, angle, weapon) => {
    let a = poly('-22,0 25,-2 30,66 16,86 -20,78 -29,34', 'url(#steel)');
    a += poly('-30,7 26,3 33,49 3,61 -32,39', 'url(#armor)');
    a += '<circle cx="0" cy="84" r="18" fill="url(#steel)"/>';
    a += poly('-26,85 22,78 32,145 13,173 -20,166 -34,123', 'url(#armor)');
    a += poly('-23,92 -4,91 4,144 -17,156', shadow);
    a += path('M 5 95 L 18 93 L 23 132 M -19 125 L -10 133', blue);
    a += poly('-18,165 14,163 24,186 8,204 -18,194', 'url(#steel)');
    if (weapon) {
      if (p.blade) {
        a += poly('-27,184 35,178 42,187 -25,198', trim);
        a += poly('10,187 24,183 203,129 166,153', glow, glow, 2);
        a += path('M 23 188 L 186 137', '#f0ffff', 4);
      } else {
        a += group('translate(0 182) rotate(-6)',
          poly('-30,-8 25,-8 39,18 28,85 10,86 6,153 -12,157 -17,74 -34,65', 'url(#steel)') +
          poly('27,19 42,30 36,61 25,61', shadow) +
          path('M -5 33 L -4 130', blue, 5) +
          path('M -19 8 L 17 8', glow, 4));
      }
    } else {
      a += poly('-38,70 20,67 42,100 24,222 -9,259 -44,178', blue);
      a += poly('-31,80 13,78 25,106 12,206 -9,230 -30,173', 'url(#armor)');
      a += poly('-17,103 -2,103 7,192 -5,214 -17,169', blue);
      a += path('M -23 95 L 7 92', trim, 4);
    }
    return group('translate(' + x + ' ' + y + ') rotate(' + angle + ')', a);
  };
  body += arm(231, 242, p.la, false);
  body += poly('252,205 329,195 375,225 360,306 327,333 276,323 242,281', 'url(#steel)');
  body += poly('239,212 286,201 316,218 342,203 373,223 355,282 312,305 258,282', blue);
  body += poly('244,214 283,203 292,229 256,245', 'url(#armor)');
  body += poly('321,218 343,204 370,222 352,248 315,240', shadow);
  body += poly('255,244 284,238 290,259 260,264', trim);
  body += poly('324,244 352,249 348,268 320,261', trim);
  body += poly('260,247 280,243 282,255 263,258', '#111a29');
  body += poly('328,249 348,253 345,263 325,258', '#111a29');
  body += poly('288,269 314,270 321,302 303,316 286,298', shadow);
  body += poly('297,276 307,277 312,297 303,305 296,295', glow, glow);
  body += path('M 266 282 L 284 294 M 327 292 L 345 281 M 274 313 L 327 322', main);
  // Shoulder plates.
  body += poly(rival ? '184,178 251,217 245,261 188,241 164,204' : '178,205 221,191 255,214 243,256 189,243', 'url(#armor)');
  body += poly('184,208 220,201 243,217 231,233 195,227', main);
  body += path('M 192 214 L 222 215', rival ? glow : shadow, 3);
  body += arm(363, 239, p.ra, true);
  body += poly(rival ? '358,217 427,170 419,232 370,262 346,241' : '347,214 394,187 429,214 412,248 368,260', 'url(#armor)');
  body += poly('359,221 397,201 416,215 401,237 369,245', main);
  body += path('M 375 221 L 397 211 M 389 239 L 404 229', shadow, 3);
  // Neck and compact head: V-fin, red forehead, unmistakable sensor color.
  body += poly('281,175 325,172 332,207 300,224 276,204', 'url(#steel)');
  body += poly('268,121 296,96 326,105 345,133 335,179 309,205 280,188 261,158', 'url(#armor)');
  body += poly('270,130 288,116 300,132 292,165 273,165', main);
  body += poly('302,117 326,115 340,136 333,167 310,172 292,153', shadow);
  body += poly('271,145 296,151 300,163 278,158', glow, glow);
  body += poly('303,153 334,140 328,156 303,165', glow, glow);
  body += poly('280,165 301,171 324,161 321,183 306,199 286,183', main);
  body += poly('296,169 308,167 311,190 303,199 295,185', rival ? '#932a40' : '#b94149');
  body += path('M 284 171 L 294 177 M 284 179 L 293 183 M 314 174 L 321 170', '#162438', 2);
  body += poly(rival ? '289,136 224,56 276,111 302,147' : '292,135 212,74 276,108 302,148', trim);
  body += poly(rival ? '305,137 373,42 337,115 302,147' : '305,137 372,67 337,115 302,147', trim);
  body += poly('291,113 302,106 314,114 307,148 297,149', rival ? '#b63a4d' : '#c13e48');
  body += poly('291,103 301,98 310,107 306,118 295,116', glow);
  body += path('M 266 141 L 255 150 L 262 173 M 338 132 L 350 135 L 345 160', shadow, 4);
  if (rival) body += poly('276,122 270,62 290,101 293,121', main);
  s += group('translate(25 10) rotate(' + p.body + ' 300 310)', body);
  s += '</svg>';
  return s;
}
for (const unit of ['hero', 'rival']) for (const pose of Object.keys(poses)) {
  await writeFile(new URL(unit + '-' + pose + '.svg', root), mech(unit, pose));
}
const refs = new URL('../../assets/references/', import.meta.url);
// Crop 02's left portrait. Crop 04's large PILOT face only, before its embedded dialogue.
await sharp(new URL('02-astrayon-head-and-pilot.png', refs).pathname)
  .extract({ left: 320, top: 760, width: 240, height: 345 }).resize({ width: 500 })
  .webp({ quality: 90 }).toFile(new URL('pilot-hero.webp', root).pathname);
await sharp(new URL('04-obsidian-masked-pilot.png', refs).pathname)
  .extract({ left: 681, top: 574, width: 321, height: 247 }).resize({ width: 680 })
  .webp({ quality: 90 }).toFile(new URL('pilot-rival.webp', root).pathname);
const manifest = {
  status: 'TEMPORARY_ANIMATIC_NOT_FINAL_ART',
  generatedBy: 'scripts/create-animatic.mjs',
  poses: Object.keys(poses),
  machines: 'Code-authored SVG pose studies based on reference identity; replace with approved original action drawings.',
  pilots: [
    { file: 'pilot-hero.webp', reference: '02 face only, helmet insignia excluded', crop: [320, 760, 240, 345], flipped: false },
    { file: 'pilot-rival.webp', reference: '04 large PILOT portrait', crop: [681, 574, 321, 247], flipped: false },
  ],
  background: 'Procedural PixiJS orbital scene, no poster textures',
  audio: 'Web Audio synthesized temporary SFX; no BGM recording or voice acting',
};
await writeFile(new URL('asset-manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log('Created 14 temporary SVG poses and 2 reference-only pilot crops.');
