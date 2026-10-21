// Usage: node scripts/commons-search.js "query" [limit]
// Lists Wikimedia Commons image candidates with license metadata (CC0/PD/CC BY/CC BY-SA only).
const https = require('https');
const q = process.argv[2];
const limit = parseInt(process.argv[3] || '30', 10);
const OK = /^(cc0|pd|public domain|cc[- ]by(-sa)?[- ]\d|cc by(-sa)? \d)/i;

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'WeldingTradeSchoolRedesign/1.0 (educational project)' } }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

(async () => {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6' +
    '&gsrlimit=' + limit + '&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') +
    '&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=400';
  const j = await get(url);
  const pages = Object.values((j.query && j.query.pages) || {});
  for (const p of pages) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || ii.mime !== 'image/jpeg') continue;
    const m = ii.extmetadata || {};
    const lic = (m.LicenseShortName && m.LicenseShortName.value) || '';
    if (!OK.test(lic)) continue;
    if (ii.width < 1600) continue;
    const artist = ((m.Artist && m.Artist.value) || '').replace(/<[^>]+>/g, '').slice(0, 40);
    console.log([p.title.replace('File:', ''), ii.width + 'x' + ii.height, lic, artist].join(' | '));
  }
})();
