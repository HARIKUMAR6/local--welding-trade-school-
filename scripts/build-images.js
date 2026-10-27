/**
 * Image pipeline: downloads each photo in scripts/image-manifest.json from Wikimedia Commons
 * and writes optimized, responsive local copies.
 *   node scripts/build-images.js            # download (cached) + metadata + optimize
 *   node scripts/build-images.js --offline  # optimize from cache only
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));
const CACHE = path.join(__dirname, '.cache', 'originals');
const OUT = path.join(ROOT, 'assets', 'images');
const WIDTHS = [480, 800, 1200, 1600, 1920];
const WIDE = new Set(['h1-hero', 'h1-lab', 'h2-hero-a', 'h2-instructor', 'h2-close', 'pg-hero', 'pg-mig', 'pg-stick', 'pg-path', 'in-hero-a', 'in-hero-b', 'in-watch', 'in-close', 'ab-who', 'ab-philosophy']); // full-bleed / hero images keep 1920
const capFor = (key, meta) => (WIDE.has(key) ? 1920 : (meta.height > meta.width ? 1200 : 1600));
const UA = { 'User-Agent': 'WeldingTradeSchoolRedesign/1.0 (educational project)' };
const offline = process.argv.includes('--offline');
const dirFor = (key) => (key.startsWith('h1') ? 'h1' : key.startsWith('pg-') ? 'programs' : key.startsWith('in-') ? 'instructors' : key.startsWith('ab-') ? 'about' : key.startsWith('ct-') ? 'contact' : 'h2');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchBuf(url, depth = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: UA }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && depth < 6) {
        r.resume();
        return res(fetchBuf(new URL(r.headers.location, url).toString(), depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
    }).on('error', rej);
  });
}

async function download() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const [key, m] of Object.entries(manifest)) {
    const dest = path.join(CACHE, key + '.jpg');
    if (fs.existsSync(dest) && fs.statSync(dest).size > 20000) continue;
    const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(m.file.replace(/ /g, '_')) + '?width=' + m.width;
    for (let a = 0; a < 5; a++) {
      try { fs.writeFileSync(dest, await fetchBuf(url)); console.log('downloaded', key); break; }
      catch (e) { console.log('retry', key, a, e.message); await sleep(6000 * (a + 1)); }
    }
    await sleep(3000);
  }
}

async function optimize() {
  const data = {};
  for (const key of Object.keys(manifest)) {
    const src = path.join(CACHE, key + '.jpg');
    if (!fs.existsSync(src)) { console.log('MISSING original', key); continue; }
    const dir = path.join(OUT, dirFor(key));
    fs.mkdirSync(dir, { recursive: true });
    const meta = await sharp(src).metadata();
    const cap = Math.min(capFor(key, meta), meta.width);
    const ws = WIDTHS.filter((w) => w < cap);
    ws.push(cap);
    for (const w of ws) {
      await sharp(src).rotate().resize({ width: w }).webp({ quality: 72, effort: 5 }).toFile(path.join(dir, `${key}-${w}.webp`));
    }
    const fbW = Math.min(1200, meta.width);
    await sharp(src).rotate().resize({ width: fbW }).jpeg({ quality: 78, progressive: true, mozjpeg: true }).toFile(path.join(dir, `${key}.jpg`));
    const rot = meta.orientation && meta.orientation >= 5;
    data[key] = { w: rot ? meta.height : meta.width, h: rot ? meta.width : meta.height, widths: ws, dir: path.basename(dir) };
    console.log('optimized', key, ws.join(','));
  }
  fs.writeFileSync(path.join(OUT, 'image-data.json'), JSON.stringify(data, null, 2));
}

(async () => {
  if (!offline) { await download(); }
  await optimize();
})();
