/**
 * Shared shell QA (header, footer, menu, scroll-to-top) on every page at the 7 required viewports.
 *  - header: Home ▼, Programs, Instructors, About, Contact, Dashboard (no Certification / Careers), desktop and mobile
 *  - no browser tooltips (title=) or pop-ups on theme / direction controls; they still work and persist
 *  - menu: Light and Dark buttons side by side, identical width and height, pressed state follows the theme
 *  - footer: no CTA buttons, no theme/direction controls, no "Back to top"; exactly 4 social icons, honest labels;
 *    Student Login and Contact admissions carry icons
 *  - scroll-to-top: hidden at the top, shown after scrolling, returns to the top (instant with reduced motion),
 *    mirrors in RTL, and never covers text, links, buttons or form controls while it is visible
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const PAGES = ['index.html', 'home-2.html', 'programs.html', 'instructors.html', 'about.html', 'contact.html', 'credits.html']; // login/dashboard are app pages: see test/portal.js
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

// visible interactive/text elements the floating button must not cover
function coveredBy(sel) {
  const btn = document.querySelector(sel);
  if (!btn || btn.hidden) return [];
  const br = btn.getBoundingClientRect();
  const hits = [];
  document.querySelectorAll('main a, main button, main input, main select, main textarea, main p, main h1, main h2, main h3, main li, main dd, main dt, main label, footer a, footer p, footer h2, footer li span').forEach((el) => {
    if (el.closest('#enroll-bar') || el === btn || btn.contains(el)) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // only the element's own text box matters for text containers
    const rects = (el.matches('p, h1, h2, h3, li, dd, dt, label, span')) ? (() => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()]; })() : [r];
    for (const t of rects) {
      const ox = Math.min(br.right, t.right) - Math.max(br.left, t.left);
      const oy = Math.min(br.bottom, t.bottom) - Math.max(br.top, t.top);
      if (ox > 1 && oy > 1) { hits.push(el.tagName.toLowerCase() + ':' + (el.textContent || '').trim().slice(0, 30)); break; }
    }
  });
  return hits;
}

(async () => {
  const b = await launch();
  for (const [vpName, size] of Object.entries(VIEWPORTS)) {
    const desktop = size.width >= 1280;
    for (const page of PAGES) {
      for (const dir of (page === 'contact.html' || page === 'index.html') ? ['ltr', 'rtl'] : ['ltr']) {
        const ctx = await b.newContext({ viewport: size, hasTouch: !desktop, colorScheme: 'light' });
        await ctx.addInitScript((d) => { try { localStorage.setItem('wts_dir', d); } catch (e) {} }, dir);
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e)));
        p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
        await p.goto(`${BASE}/${page}`, { waitUntil: 'load', timeout: 60000 });
        const tag = `${page} @ ${vpName} ${dir}`;

        // ---- header ----
        const navSel = desktop ? '.nav-desktop' : '#nav-sheet nav';
        if (!desktop) { await p.tap('#nav-toggle'); await p.waitForTimeout(120); }
        const items = await p.$$eval(`${navSel} > *`, (els) => els.filter((e) => e.offsetParent !== null && !e.matches('.sheet-sub')).map((e) => e.innerText.trim().replace(/\s+/g, ' ')));
        ok(items.join('|').toLowerCase() === 'home|programs|instructors|about|contact|dashboard', `${tag}: nav items ${items.join('|')}`);
        ok((await p.$$eval('#site-header a, #site-header button', (els) => els.filter((e) => /^(Certification|Careers)$/.test(e.textContent.trim())).length)) === 0, `${tag}: no Certification or Careers in header`);
        ok((await p.$$eval('#site-header a', (as) => as.filter((a) => a.textContent.trim() === 'Dashboard').map((a) => a.getAttribute('href')))).every((h) => h === 'dashboard.html'), `${tag}: Dashboard links to dashboard.html`);
        ok((await p.$$eval('#site-header [title], footer [title], [data-action][title], [data-set-theme][title]', (e) => e.length)) === 0, `${tag}: no title tooltips in header/footer controls`);

        if (!desktop) {
          // equal Light / Dark buttons
          const pair = await p.$$eval('[data-set-theme]', (bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10, Math.round(r.top), x.textContent.trim()]; }));
          ok(pair.length === 2 && pair[0][0] === pair[1][0] && pair[0][1] === pair[1][1] && pair[0][2] === pair[1][2], `${tag}: Light/Dark equal size, side by side ${JSON.stringify(pair)}`);
          if (vpName === 'mobile-390' && dir === 'ltr' && page === 'index.html') {
            const tipBefore = await p.$$eval('[role="tooltip"], [role="alert"], [aria-live]', (e) => e.filter((x) => x.offsetParent !== null && !x.closest('form') && !x.closest('[data-map]')).length);
            await p.tap('[data-set-theme="dark"]');
            ok(await p.evaluate(() => document.documentElement.classList.contains('dark') && localStorage.getItem('wts_theme') === 'dark'), 'Dark button switches and saves the theme');
            ok((await p.getAttribute('[data-set-theme="dark"]', 'aria-pressed')) === 'true' && (await p.getAttribute('[data-set-theme="light"]', 'aria-pressed')) === 'false', 'pressed state follows the theme');
            await p.tap('#nav-sheet [data-action="toggle-dir"]');
            ok(await p.evaluate(() => document.documentElement.dir === 'rtl'), 'menu direction button switches to RTL');
            const tipAfter = await p.$$eval('[role="tooltip"], [role="alert"], [aria-live]', (e) => e.filter((x) => x.offsetParent !== null && !x.closest('form') && !x.closest('[data-map]')).length);
            ok(tipAfter === tipBefore, 'no pop-up or toast appears after theme/direction changes');
            await p.tap('#nav-sheet [data-action="toggle-dir"]');
            await p.tap('[data-set-theme="light"]');
            ok(await p.evaluate(() => !document.documentElement.classList.contains('dark')), 'Light button switches back');
          }
          await p.tap('#nav-toggle'); await p.waitForTimeout(80);
        }

        // ---- footer ----
        const foot = await p.evaluate(() => {
          const f = document.getElementById('site-footer');
          return {
            btns: f.querySelectorAll('.btn').length,
            toggles: f.querySelectorAll('[data-action], [data-set-theme]').length,
            backTop: [...f.querySelectorAll('a')].some((a) => /back to top/i.test(a.textContent)),
            social: [...f.querySelectorAll('.social-icon')].map((s) => s.getAttribute('aria-label')),
            socialLinks: [...f.querySelectorAll('.social a')].length,
            studentIcons: [...f.querySelectorAll('.footer-link-icon')].map((a) => [a.textContent.trim(), !!a.querySelector('svg'), (() => { const i = a.querySelector('svg').getBoundingClientRect(), t = a.querySelector('span').getBoundingClientRect(); return Math.abs((i.top + i.bottom) / 2 - (t.top + t.bottom) / 2) < 3; })()])
          };
        });
        ok(foot.btns === 0 && foot.toggles === 0 && !foot.backTop, `${tag}: footer has no CTA buttons, toggles or Back to top`);
        ok(foot.social.length === 4 && foot.social.every((l) => /not yet published/.test(l)), `${tag}: exactly 4 social icons with honest labels`);
        ok(foot.socialLinks === 0, `${tag}: social icons do not link to unverified profiles`);
        ok(foot.studentIcons.length === 2 && foot.studentIcons.every((s) => s[1] && s[2]) && /Student Login/.test(foot.studentIcons[0][0]) && /Contact admissions/.test(foot.studentIcons[1][0]), `${tag}: student links have vertically centred icons`);

        // ---- scroll to top ----
        ok(await p.$eval('#to-top', (x) => x.hidden), `${tag}: scroll-to-top hidden at the top`);
        const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        if (total > 900) {
          const stops = [0.35, 0.6, 0.85, 1].map((f) => Math.round(total * f));
          let shownSomewhere = false; const cover = new Set();
          for (const y of stops) {
            await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
            await p.waitForTimeout(160);
            const vis = await p.$eval('#to-top', (x) => !x.hidden && getComputedStyle(x).display !== 'none');
            if (vis) {
              shownSomewhere = true;
              const docked = await p.$eval('#to-top', (x) => x.classList.contains('in-bar'));
              if (docked) {
                // docked into the sticky enroll bar: it must stay inside the bar's own footprint
                const inside = await p.evaluate(() => { const a = document.getElementById('to-top').getBoundingClientRect(), b = document.getElementById('enroll-bar').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1; });
                if (!inside) cover.add('outside the enroll bar');
              } else (await p.evaluate(coveredBy, '#to-top')).forEach((h) => cover.add(h));
            }
          }
          ok(shownSomewhere, `${tag}: scroll-to-top appears after scrolling`);
          ok(cover.size === 0, `${tag}: scroll-to-top covers nothing ${[...cover].slice(0, 3).join(' / ')}`);
          const side = await p.$eval('#to-top', (x) => { const r = x.getBoundingClientRect(); return r.left + r.width / 2 > innerWidth / 2 ? 'right' : 'left'; });
          ok(side === (dir === 'rtl' ? 'left' : 'right'), `${tag}: scroll-to-top on the ${dir === 'rtl' ? 'left' : 'right'}`);
          await p.click('#to-top');
          for (let i = 0; i < 40 && (await p.evaluate(() => window.scrollY)) > 1; i++) await p.waitForTimeout(100);
          ok((await p.evaluate(() => window.scrollY)) < 2, `${tag}: click returns to the top`);
        }
        ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no horizontal overflow`);
        ok(errs.length === 0, `${tag}: no console errors ${errs.join(' | ')}`);
        await ctx.close();
      }
    }
  }
  // reduced motion: instant scroll
  {
    const ctx = await b.newContext({ viewport: VIEWPORTS['desktop-1440'], reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/home-2.html`, { waitUntil: 'load' });
    await p.evaluate(() => window.scrollTo({ top: 4000, behavior: 'instant' })); await p.waitForTimeout(200);
    await p.click('#to-top');
    await p.waitForTimeout(60);
    ok((await p.evaluate(() => window.scrollY)) < 2, 'reduced motion: scroll-to-top is instant');
    await ctx.close();
  }
  await b.close();
  console.log(`\nShell QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
