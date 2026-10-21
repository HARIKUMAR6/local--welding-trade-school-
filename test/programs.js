/**
 * Programs page QA: content completeness for all three processes, no unverified facts, link/anchor integrity,
 * unique local photos, the shared inner-page hero height rule at the 8 required viewports, light/dark and LTR/RTL layout.
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

const html = fs.readFileSync(path.join(ROOT, 'programs.html'), 'utf8');
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

// ---- unverified facts ----
const banned = /(\$\s?\d|tuition|\bprice|\bweeks?\b|\bmonths?\b|\bsemesters?\b|accredit|guarantee|prerequisite|\baws\b|\basme\b|\bcwi\b|osha|financial aid|job placement|\d+\s?%|est\.\s?\d{4}|lorem|todo|coming soon|\[add)/;
ok(!banned.test(text), 'page contains no unverified facts (fees, durations, accreditation, named bodies, guarantees, placeholders): ' + (text.match(banned) || [''])[0]);

// ---- static content ----
for (const [id, name, minSkills] of [['mig', 'MIG', 4], ['tig', 'TIG', 4], ['stick', 'Stick', 4]]) {
  const sec = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
  ok(sec.includes('<h2'), `${name}: has its own heading`);
  ok(/Where it is used/i.test(sec), `${name}: says where it is used`);
  ok(((sec.match(/<li>/g) || []).length) >= minSkills, `${name}: lists at least ${minSkills} skills`);
  ok(/<picture>/.test(sec), `${name}: has its own photo`);
  ok(sec.includes('href="contact.html"'), `${name}: next-step link goes to the existing Contact page`);
}
const rows = (html.match(/<tbody[\s\S]*?<\/tbody>/) || [''])[0].match(/<tr\b/g) || [];
ok(rows.length === 5, 'compare table has 5 rows');
ok(((html.match(/<thead[\s\S]*?<\/thead>/) || [''])[0].match(/<th\b/g) || []).length === 3, 'compare table has 3 process columns');
ok(((html.match(/<tbody[\s\S]*?<\/tbody>/) || [''])[0].match(/<td\b/g) || []).length === 15, 'compare table has 15 data cells (no gaps)');

const imgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
ok(imgs.length === 7, `7 photos on the page (${imgs.length})`);
ok(new Set(imgs).size === imgs.length, 'no photo is used twice on this page');
ok(imgs.every((s) => s.startsWith('assets/images/programs/pg-') && fs.existsSync(path.join(ROOT, s))), 'all photos are local, in assets/images/programs, and exist');
const others = ['index.html', 'home-2.html'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('');
ok(imgs.every((s) => !others.includes(s)), 'no Programs photo appears on Home 1 or Home 2');
const inner = html.match(/class="inner-hero /); ok(!!inner, 'hero uses the shared .inner-hero class');

(async () => {
  const b = await launch();
  const ctx0 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p0 = await ctx0.newPage();
  const errs = [];
  p0.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p0.on('pageerror', (e) => errs.push(String(e)));
  await p0.goto(`${BASE}/programs.html`, { waitUntil: 'networkidle' });
  ok(errs.length === 0, 'no console errors ' + errs.join(' | '));
  ok((await p0.getAttribute('a.nav-link[href="programs.html"]', 'aria-current')) === 'page', 'Programs is the current page in the header');
  ok((await p0.$$('#site-header [data-home-anchor]')).length === 0, 'header has no Certification or Careers links (removed site-wide)');
  for (const id of ['compare', 'mig', 'tig', 'stick', 'certification', 'enroll']) ok((await p0.$('#' + id)) !== null, `anchor #${id} exists`);
  const board = await p0.$$eval('.pg-board a', (as) => as.map((a) => a.getAttribute('href')));
  ok(board.join() === '#mig,#tig,#stick', 'hero directory links to the three process sections');
  await p0.click('.pg-board a[href="#tig"]'); await p0.waitForTimeout(700);
  const top = await p0.$eval('#tig', (e) => Math.round(e.getBoundingClientRect().top));
  ok(top >= 0 && top < 200, `directory link scrolls #tig into view below the sticky header (top=${top})`);
  ok((await p0.$$eval('h1', (h) => h.length)) === 1, 'exactly one h1');
  await ctx0.close();

  // ---- hero height rule across the 8 viewports, both themes ----
  const heights = {};
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
      const ctx = await b.newContext({ viewport: size, colorScheme: theme, hasTouch: size.width < 1024 });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/programs.html`, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      const m = await p.evaluate(() => {
        const hero = document.querySelector('.inner-hero');
        const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;min-height:var(--inner-hero-h)'; document.body.appendChild(probe);
        const rule = probe.getBoundingClientRect().height; probe.remove();
        const hr = hero.getBoundingClientRect();
        const cta = hero.querySelector('.btn-primary').getBoundingClientRect();
        return { h: Math.round(hr.height), rule: Math.round(rule), top: Math.round(hr.top), ctaBottom: Math.round(cta.bottom), vh: innerHeight, over: document.documentElement.scrollWidth - innerWidth, dark: document.documentElement.classList.contains('dark'), dir: document.documentElement.dir };
      });
      heights[`${name}`] = m.h;
      const tag = `${name} ${theme}/${dir}`;
      ok(m.over <= 0, `${tag}: no horizontal overflow (${m.over})`);
      ok(m.dark === (theme === 'dark') && m.dir === dir, `${tag}: theme and direction applied`);
      const shortLandscape = size.height <= 520 && size.width > size.height;
      if (!shortLandscape && size.width >= 1024) ok(Math.abs(m.h - m.rule) <= 2, `${tag}: hero height ${m.h}px equals the shared rule ${m.rule}px`);
      else if (!shortLandscape) ok(m.h >= m.rule - 1, `${tag}: hero ${m.h}px is at least the shared rule ${m.rule}px (content-driven when stacked)`);
      if (size.width >= 768) ok(m.ctaBottom <= m.vh, `${tag}: hero CTA inside the first screen (${m.ctaBottom}/${m.vh})`);
      await ctx.close();
    }
  }
  console.log('hero heights by viewport:', JSON.stringify(heights));
  await b.close();
  console.log(`\nPrograms QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
