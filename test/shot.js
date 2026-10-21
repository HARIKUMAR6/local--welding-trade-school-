// Usage: node test/shot.js <page> <viewportName|WxH> <light|dark> <out.png> [fullPage]
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
(async () => {
  const [page, vp, theme, out, full] = process.argv.slice(2);
  const size = VIEWPORTS[vp] || { width: +vp.split('x')[0], height: +vp.split('x')[1] };
  const b = await launch();
  const ctx = await b.newContext({ viewport: size, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('wts_theme', t); } catch (e) {} }, theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: out, fullPage: full === 'full' });
  if (errs.length) console.log('CONSOLE ERRORS:', errs.join('\n'));
  await b.close();
})();
