/**
 * About page QA: exactly five sections, no unverified school claims, unique local photos (never used on another page),
 * the shared inner-page hero height rule, light/dark and LTR/RTL layout, links.
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

const html = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

// ---- no unverified school claims ----
const banned = /(founded|since \d{4}|\best\.|\b(19|20)\d{2}\b|accredit|\d+\s?%|\d[\d,]*\+? (students|graduates)|success rate|guarantee|\bawards?\b|testimonial|ranked|years? of experience|certified (inspector|instructor)|\baws\b|\basme\b|\bcwi\b|tuition|\$\s?\d|lorem|todo|placeholder|coming soon|\[add)/;
ok(!banned.test(text), 'no unverified school claims or placeholders: ' + (text.match(banned) || [''])[0]);

// ---- structure ----
const sections = (main.match(/<section\b/g) || []).length;
ok(sections === 5, `exactly five sections including the hero (${sections})`);
ok(main.includes('class="inner-hero '), 'hero uses the shared .inner-hero rule');
for (const id of ['who', 'philosophy', 'trade', 'next']) ok(main.includes(`id="${id}"`), `section #${id} present`);
for (const pr of ['mig', 'tig', 'stick']) ok(main.includes(`href="programs.html#${pr}"`), `${pr} links to its Programs section`);
ok(main.includes('href="programs.html" class="ab-door') && main.includes('href="contact.html" class="ab-door'), 'next-step doors go to programs.html and contact.html');
const progHtml = fs.readFileSync(path.join(ROOT, 'programs.html'), 'utf8');
for (const id of ['mig', 'tig', 'stick']) ok(progHtml.includes(`id="${id}"`), `programs.html#${id} exists`);

// ---- photos ----
const imgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
ok(imgs.length === 6, `6 photos on the page (${imgs.length})`);
ok(new Set(imgs).size === imgs.length, 'no photo used twice on this page');
ok(imgs.every((s) => s.startsWith('assets/images/about/ab-') && fs.existsSync(path.join(ROOT, s))), 'all photos local, in assets/images/about, and present');
const others = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !['about.html', 'credits.html'].includes(f)).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('');
ok(imgs.map((s) => 'about/' + path.basename(s, '.jpg')).every((k) => !others.includes(k)),'no About photo (any size or format) appears on another page');
const sources = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/image-manifest.json'), 'utf8'))).map((m) => m.file);
ok(new Set(sources).size === sources.length, 'every photo on the site comes from a different source image');

(async () => {
  const b = await launch();
  const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p0 = await c0.newPage();
  const errs = [];
  p0.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p0.on('pageerror', (e) => errs.push(String(e)));
  await p0.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  ok(errs.length === 0, 'no console errors ' + errs.join(' | '));
  ok((await p0.getAttribute('a.nav-link[href="about.html"]', 'aria-current')) === 'page', 'About is the current page in the header');
  ok((await p0.$$eval('h1', (h) => h.length)) === 1, 'exactly one h1');
  // triptych photos are the same size
  const triH = await p0.$$eval('.ab-tri-photo', (ps) => ps.map((p) => Math.round(p.getBoundingClientRect().height)));
  ok(new Set(triH).size === 1, `triptych photos share one height (${triH.join(', ')})`);
  await c0.close();

  const heights = {};
  for (const name of ['desktop-1440', 'laptop-1366', 'tablet-landscape-1024', 'tablet-portrait-768', 'mobile-390', 'mobile-small-320', 'mobile-landscape-844']) {
    const size = VIEWPORTS[name];
    for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
      const ctx = await b.newContext({ viewport: size, colorScheme: theme, hasTouch: size.width < 1024 });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); } });
      await p.waitForTimeout(800);
      await p.evaluate(() => window.scrollTo(0, 0));
      const m = await p.evaluate(() => {
        const hero = document.querySelector('.inner-hero');
        const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;min-height:var(--inner-hero-h)'; document.body.appendChild(probe);
        const rule = probe.getBoundingClientRect().height; probe.remove();
        const imgs = [...document.querySelectorAll('main img')];
        return {
          h: Math.round(hero.getBoundingClientRect().height), rule: Math.round(rule),
          cta: Math.round(hero.querySelector('.btn-primary').getBoundingClientRect().bottom), vh: innerHeight,
          over: document.documentElement.scrollWidth - innerWidth,
          broken: imgs.filter((i) => i.getBoundingClientRect().width > 0 && !(i.complete && i.naturalWidth > 0)).length,
          dark: document.documentElement.classList.contains('dark'), dir: document.documentElement.dir
        };
      });
      heights[name] = m.h;
      const tag = `${name} ${theme}/${dir}`;
      ok(m.over <= 0, `${tag}: no horizontal overflow (${m.over})`);
      ok(m.broken === 0, `${tag}: all images loaded`);
      ok(m.dark === (theme === 'dark') && m.dir === dir, `${tag}: theme and direction applied`);
      const shortLandscape = size.height <= 520 && size.width > size.height;
      if (!shortLandscape && size.width >= 768) ok(Math.abs(m.h - m.rule) <= 2, `${tag}: hero ${m.h}px equals the shared rule ${m.rule}px`);
      else if (!shortLandscape) ok(m.h >= m.rule - 1, `${tag}: hero ${m.h}px at least the shared rule ${m.rule}px`);
      if (size.width >= 768) ok(m.cta <= m.vh, `${tag}: hero CTA in the first screen (${m.cta}/${m.vh})`);
      await ctx.close();
    }
  }
  console.log('hero heights:', JSON.stringify(heights));
  await b.close();
  console.log(`\nAbout QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
