// Usage: node scripts/commons-fetch.js <outDir> <width> <name1> <name2> ...   (or --list file.txt)
// Downloads Commons files at a given width via Special:FilePath, politely throttled.
const https = require('https');
const fs = require('fs');
const path = require('path');
const [outDir, width, ...rest] = process.argv.slice(2);
let names = rest;
if (rest[0] === '--list') names = fs.readFileSync(rest[1], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
fs.mkdirSync(outDir, { recursive: true });
const UA = { 'User-Agent': 'WeldingTradeSchoolRedesign/1.0 (educational project)' };

function fetch(url, depth = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: UA }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && depth < 6) {
        const next = new URL(r.headers.location, url).toString();
        r.resume();
        return res(fetch(next, depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => res(Buffer.concat(chunks)));
    }).on('error', rej);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const n of names) {
    const out = path.join(outDir, n.replace(/[^\w.\- ]/g, '_').replace(/\.jpe?g$/i, '').slice(0, 80) + '.jpg');
    if (fs.existsSync(out)) continue;
    const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(n.replace(/ /g, '_')) + '?width=' + width;
    let ok = false;
    for (let a = 0; a < 4 && !ok; a++) {
      try { fs.writeFileSync(out, await fetch(url)); ok = true; console.log('ok  ', n.slice(0, 70)); }
      catch (e) { console.log('retry', a, e.message.slice(0, 60)); await sleep(5000 * (a + 1)); }
    }
    await sleep(2500);
  }
})();
