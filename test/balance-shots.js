/**
 * Before/after helper for section balance work.
 *   node test/balance-shots.js <outDir> [viewports] [themes] [dirs]
 * Screenshots the four target sections and prints measurements: section height, content bounding box, and the
 * largest "empty band" inside each section (vertical space not covered by any visible child), plus column height
 * imbalance for two-column layouts.
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const fs = require('fs');
const [outDir, vps = 'desktop-1440,laptop-1366,tablet-portrait-768,tablet-landscape-1024,mobile-390,mobile-small-320,mobile-landscape-844', themes = 'light', dirs = 'ltr'] = process.argv.slice(2);
const TARGETS = [
  { name: 'h1-school', page: 'index.html', sel: 'section[aria-labelledby="identity-title"]' },
  { name: 'h1-processes', page: 'index.html', sel: '#programs' },
  { name: 'h2-programs', page: 'home-2.html', sel: '#programs' },
  { name: 'h2-cert', page: 'home-2.html', sel: '#certification' }
];

function measure(sel) {
  const sec = document.querySelector(sel);
  const sr = sec.getBoundingClientRect();
  const cs = getComputedStyle(sec);
  const kids = [...sec.querySelectorAll('*')].filter((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let x = e; x && x !== sec; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; }
    // leaf-ish content only: text, images, svg
    return e.matches('h1,h2,h3,h4,p,li,img,a,button,dt,dd,svg,.photo,.tag,.mod,.tabpanel,.tablist');
  });
  // largest vertical band between consecutive content (full-width union of intervals)
  const iv = kids.map((e) => { const r = e.getBoundingClientRect(); return [r.top - sr.top, r.bottom - sr.top]; }).sort((a, b) => a[0] - b[0]);
  let covered = 0, maxGap = 0, gapAt = 0, end = parseFloat(cs.paddingTop);
  for (const [s, e] of iv) { if (s > end) { if (s - end > maxGap) { maxGap = s - end; gapAt = end; } } end = Math.max(end, e); }
  const contentTop = iv.length ? iv[0][0] : 0, contentBottom = end;
  // column imbalance: direct grid children of the first .wrap grid
  const grid = [...sec.querySelectorAll('.wrap > .grid, .wb-mods, .tabs, .cert-grid, .school-body')].find((g) => getComputedStyle(g).display === 'grid');
  let cols = null;
  if (grid) {
    const gk = [...grid.children].filter((c) => c.getBoundingClientRect().height > 0);
    const widths = gk.map((c) => Math.round(c.getBoundingClientRect().width));
    const heights = gk.map((c) => {
      // content height = bottom of last visible descendant - top of first
      const ds = [...c.querySelectorAll('*')].filter((d) => d.getBoundingClientRect().height > 0);
      if (!ds.length) return Math.round(c.getBoundingClientRect().height);
      const t = Math.min(...ds.map((d) => d.getBoundingClientRect().top)), b = Math.max(...ds.map((d) => d.getBoundingClientRect().bottom));
      return Math.round(b - t);
    });
    cols = { widths, heights };
  }
  return { h: Math.round(sr.height), padTop: Math.round(parseFloat(cs.paddingTop)), padBottom: Math.round(parseFloat(cs.paddingBottom)), topSpace: Math.round(contentTop), bottomSpace: Math.round(sr.height - contentBottom), maxInnerGap: Math.round(maxGap), cols };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await launch();
  for (const vp of vps.split(',')) for (const theme of themes.split(',')) for (const dir of dirs.split(',')) {
    const ctx = await b.newContext({ viewport: VIEWPORTS[vp], colorScheme: theme, hasTouch: vp.startsWith('mobile') });
    await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
    for (const t of TARGETS) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/${t.page}`, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } });
      await p.waitForTimeout(500);
      // hide sticky header so it never covers an element screenshot
      await p.addStyleTag({ content: '.site-header, .enroll-bar { visibility: hidden !important; }' });
      const el = await p.$(t.sel);
      const m = await p.evaluate(measure, t.sel);
      m.overflow = await p.evaluate((sel) => { const s = document.querySelector(sel); const vw = innerWidth; const bad = [...s.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; for (let x = e.parentElement; x && x !== s; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll') return false; } return r.right > vw + 1 || r.left < -1; }); return { page: document.documentElement.scrollWidth - vw, elems: bad.length }; }, t.sel);
      await el.screenshot({ path: `${outDir}/${t.name}__${vp}__${theme}__${dir}.png` });
      console.log(`${t.name.padEnd(13)} ${vp.padEnd(22)} ${theme}/${dir}  h=${m.h} pad=${m.padTop}/${m.padBottom} topSpace=${m.topSpace} bottomSpace=${m.bottomSpace} maxInnerGap=${m.maxInnerGap} overflow=${m.overflow.page}/${m.overflow.elems}` + (m.cols ? ` cols w=${m.cols.widths} h=${m.cols.heights}` : ''));
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
})();
