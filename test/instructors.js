/**
 * Instructors page QA: no fabricated instructor data, complete sections, unique local photos (never used on another
 * page), the shared inner-page hero height rule at the required viewports, light/dark and LTR/RTL layout, links.
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

const html = fs.readFileSync(path.join(ROOT, 'instructors.html'), 'utf8');
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

// ---- no fabricated instructor information ----
const banned = /(years? of experience|\d+\+? years|certified (welding )?(inspector|instructor|educator)|\bcwi\b|\bcwe\b|\baws\b|\basme\b|master welder|awards?|ratios?|\d+\s?:\s?\d+|one[- ]on[- ]one|\bmr\.|\bms\.|\bmrs\.|\bdr\.|tuition|\$\s?\d|guarantee|accredit|lorem|todo|placeholder|coming soon|\[add)/;
ok(!banned.test(text), 'no fabricated instructor facts, ratios, credentials, guarantees or placeholders: ' + (text.match(banned) || [''])[0]);
ok(!/class="[^"]*(profile|bio|team-card|faculty-card)/.test(main), 'no fake profile cards');

// ---- structure ----
for (const id of ['approach', 'booth', 'support', 'safety', 'enroll']) ok(main.includes(`id="${id}"`), `section #${id} present`);
ok(((main.match(/class="in-step /g) || []).length) === 4, 'teaching loop has 4 steps');
ok(((main.match(/<dt>/g) || []).length) === 4, 'four observation points at the booth');
ok(((main.match(/class="in-when"/g) || []).length) === 5, 'five support stages');
ok(main.includes('class="inner-hero '), 'hero uses the shared .inner-hero rule');
const ctas = [...main.matchAll(/class="btn btn-primary"[^>]*|href="([^"]+)" class="btn btn-primary"/g)].map((m) => m[1]).filter(Boolean);
ok(ctas.length >= 2 && ctas.every((h) => h === 'contact.html'), 'primary CTAs go to the existing contact page');

// ---- photos ----
const imgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
ok(imgs.length === 8, `8 photos on the page (${imgs.length})`);
ok(new Set(imgs).size === imgs.length, 'no photo used twice on this page');
ok(imgs.every((s) => s.startsWith('assets/images/instructors/in-') && fs.existsSync(path.join(ROOT, s))), 'all photos local, in assets/images/instructors, and present');
const others = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'instructors.html').map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('');
const keys = imgs.map((s) => path.basename(s, '.jpg'));
ok(keys.every((k) => !others.includes(k)), 'no Instructors photo (any size or format) appears on another page');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/image-manifest.json'), 'utf8'));
const sources = Object.values(manifest).map((m) => m.file);
ok(new Set(sources).size === sources.length, 'every photo in the site comes from a different source image');

(async () => {
  const b = await launch();
  const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p0 = await c0.newPage();
  const errs = [];
  p0.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p0.on('pageerror', (e) => errs.push(String(e)));
  await p0.goto(`${BASE}/instructors.html`, { waitUntil: 'networkidle' });
  ok(errs.length === 0, 'no console errors ' + errs.join(' | '));
  ok((await p0.getAttribute('a.nav-link[href="instructors.html"]', 'aria-current')) === 'page', 'Instructors is the current page in the header');
  ok((await p0.$$eval('h1', (h) => h.length)) === 1, 'exactly one h1');
  await p0.click('a[href="#approach"]'); await p0.waitForTimeout(700);
  const top = await p0.$eval('#approach', (e) => Math.round(e.getBoundingClientRect().top));
  ok(top >= 0 && top < 200, `"How teaching works" scrolls to the approach section (top=${top})`);
  await c0.close();

  const heights = {};
  for (const name of ['desktop-1440', 'laptop-1366', 'tablet-landscape-1024', 'tablet-portrait-768', 'mobile-390', 'mobile-small-320', 'mobile-landscape-844']) {
    const size = VIEWPORTS[name];
    for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
      const ctx = await b.newContext({ viewport: size, colorScheme: theme, hasTouch: size.width < 1024 });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/instructors.html`, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); } });
      await p.waitForTimeout(1000);
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
      if (!shortLandscape && size.width >= 1024) ok(Math.abs(m.h - m.rule) <= 2, `${tag}: hero ${m.h}px equals the shared rule ${m.rule}px`);
      else if (!shortLandscape) ok(m.h >= m.rule - 1, `${tag}: hero ${m.h}px at least the shared rule ${m.rule}px`);
      if (size.width >= 768) ok(m.cta <= m.vh, `${tag}: hero CTA in the first screen (${m.cta}/${m.vh})`);
      await ctx.close();
    }
  }
  console.log('hero heights:', JSON.stringify(heights));
  await b.close();
  console.log(`\nInstructors QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
