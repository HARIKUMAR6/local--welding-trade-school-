/**
 * Image audit (static + browser):
 *  - every photo referenced by a page exists locally; no remote image URLs
 *  - NO photo is used on more than one page, and none twice on the same page (keyed by image id, ignoring width/format)
 *  - alt text present; width/height attributes present
 *  - weight budget per file; browser check that every image (incl. hidden tab panels) loads
 * Prints the page -> section -> file inventory.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/image-manifest.json'), 'utf8'));
let fails = 0;
const fail = (m) => { fails++; console.log('FAIL', m); };

const usage = {}; // key -> [{page, count}]
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (/<img[^>]+src="https?:/i.test(html) || /srcset="https?:/i.test(html)) fail(`${page}: remote image URL`);
  const imgTags = html.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgTags) {
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1] || '';
    const alt = tag.match(/\salt="([^"]*)"/);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) fail(`${page}: ${src} missing width/height`);
    if (!alt || !alt[1].trim()) fail(`${page}: ${src} missing alt text`);
    if (!fs.existsSync(path.join(ROOT, src))) fail(`${page}: missing file ${src}`);
    const key = path.basename(src).replace(/\.jpg$/i, '');
    (usage[key] = usage[key] || []).push(page);
  }
  const srcsets = html.match(/srcset="[^"]+"/g) || [];
  for (const ss of srcsets) for (const part of ss.slice(8, -1).split(',')) {
    const f = part.trim().split(/\s+/)[0];
    if (!fs.existsSync(path.join(ROOT, f))) fail(`${page}: missing srcset file ${f}`);
    const m = path.basename(f).match(/^(.*)-\d+\.webp$/);
    if (!m || !usage[m[1]]) fail(`${page}: srcset image without matching <img>: ${f}`);
  }
}
let photoCount = 0;
console.log('\nIMAGE INVENTORY (page / section / file / license)');
for (const [key, list] of Object.entries(usage).sort()) {
  photoCount++;
  const pagesUsing = [...new Set(list)];
  if (pagesUsing.length > 1) fail(`${key} used on multiple pages: ${pagesUsing.join(', ')}`);
  if (list.length > 1) fail(`${key} used ${list.length} times on ${list[0]}`);
  console.log(`  ${pagesUsing[0].padEnd(12)} ${(manifest[key] ? manifest[key].section : '?').padEnd(30)} ${key}`);
}
for (const key of Object.keys(manifest)) if (!usage[key]) fail(`manifest image ${key} is not used on any page (remove it or place it)`);

// weight budget
for (const dir of ['h1', 'h2', 'programs', 'instructors', 'about', 'contact']) for (const f of fs.readdirSync(path.join(ROOT, 'assets/images', dir))) {
  const kb = fs.statSync(path.join(ROOT, 'assets/images', dir, f)).size / 1024;
  if (f.endsWith('.jpg') && kb > 350) fail(`${dir}/${f} fallback is ${Math.round(kb)} KB (> 350)`);
  if (f.endsWith('.webp') && /-(480|800)\.webp$/.test(f) && kb > 160) fail(`${dir}/${f} is ${Math.round(kb)} KB (> 160)`);
  if (f.endsWith('.webp') && kb > 600) fail(`${dir}/${f} is ${Math.round(kb)} KB (> 600)`);
}
// stray files in images dirs / legacy
const topLevel = fs.readdirSync(path.join(ROOT, 'assets/images')).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
if (topLevel.length) fail(`unused legacy images still in assets/images: ${topLevel.length} files`);

// browser load check, including hidden tab panels
(async () => {
  const { launch, BASE } = require('./lib/browser');
  const b = await launch();
  for (const page of pages) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
    for (const t of await p.$$('[role=tab]')) { await t.click(); await p.waitForTimeout(100); }
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
    await p.waitForTimeout(800);
    const bad = await p.$$eval('img', (imgs) => imgs.filter((i) => i.getBoundingClientRect().width > 0 && !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
    if (bad.length) fail(`${page}: images not loaded: ${bad.join(', ')}`);
    await p.close();
  }
  await b.close();
  console.log(`\nImage audit: ${photoCount} photos, ${fails} failure(s)`);
  process.exitCode = fails ? 1 : 0;
})();
