// Usage: node test/sections.js <page> <viewport> <light|dark> <outDir>
// Screenshots each <main> > section (and header/footer) so every section can be reviewed individually.
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const fs = require('fs');
(async () => {
  const [page, vp, theme, outDir] = process.argv.slice(2);
  const size = VIEWPORTS[vp] || { width: +vp.split('x')[0], height: +vp.split('x')[1] };
  fs.mkdirSync(outDir, { recursive: true });
  const b = await launch();
  const ctx = await b.newContext({ viewport: size, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('wts_theme', t); } catch (e) {} }, theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
  // trigger lazy images
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(600);
  const secs = await p.$$('main > section, footer');
  let i = 0;
  for (const s of secs) {
    const id = (await s.getAttribute('id')) || (await s.evaluate((e) => e.tagName.toLowerCase()));
    await s.screenshot({ path: `${outDir}/${String(i++).padStart(2, '0')}-${id}.png` });
  }
  console.log('sections:', i, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
  await b.close();
})();
