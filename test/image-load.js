// Usage: node test/image-load.js <page>  — scrolls the page and reports any <img> that fails to load or is blank.
const { launch, BASE } = require('./lib/browser');
(async () => {
  const page = process.argv[2];
  const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
  await p.waitForTimeout(800);
  const res = await p.$$eval('img', (imgs) => imgs.map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, shown: i.getBoundingClientRect().width })));
  const bad = res.filter((r) => !r.ok);
  console.log(page, 'images:', res.length, 'failed:', bad.length); bad.forEach((r) => console.log('  FAIL', r.src));
  await b.close();
})();
