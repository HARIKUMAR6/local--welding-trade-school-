const https = require('https');

async function search(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&gsrlimit=10';
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'WeldingSchoolSearch/1.0 (admin@example.org)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = Object.values(json.query.pages);
          const results = pages.map(p => {
            const info = p.imageinfo ? p.imageinfo[0] : {};
            const meta = info.extmetadata || {};
            return {
              title: p.title,
              url: info.url,
              size: info.size,
              mime: info.mime,
              license: meta.LicenseShortName ? meta.LicenseShortName.value : 'Public domain',
              desc: meta.ImageDescription ? meta.ImageDescription.value.replace(/<[^>]*>/g, '').substring(0, 150) : ''
            };
          }).filter(r => r.mime && r.mime.startsWith('image/jpeg') && r.size > 300000 && r.size < 8000000);
          resolve(results);
        } catch(e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

(async () => {
  const items = await search('welding testing NDT non-destructive ultrasound');
  const items2 = await search('welder inspecting weld joint steel');
  const all = [...items, ...items2];
  for (const it of all) {
    console.log('Title:', it.title);
    console.log('URL:', it.url);
    console.log('Size:', it.size, '| License:', it.license);
    console.log('Desc:', it.desc);
    console.log('---');
  }
})();
