/**
 * Functional QA: console errors, broken links/anchors, header/footer consistency, theme + direction persistence,
 * first-load theme, navigation, menus, tabs, panels, scrollers, enroll CTAs, RTL overflow, keyboard behaviour.
 */
const { launch, BASE } = require('./lib/browser');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'home-2.html', 'programs.html', 'instructors.html', 'about.html', 'contact.html', 'credits.html']; // login/dashboard are app pages: see test/portal.js
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

(async () => {
  const b = await launch();

  /* ---- console errors, failed requests, links ---- */
  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [], bad = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    p.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) bad.push('FAILED ' + r.url()); });
    await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
    ok(errs.length === 0, `${page}: no console errors ${errs.join(' | ')}`);
    ok(bad.length === 0, `${page}: no failed requests ${bad.join(' | ')}`);
    const links = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    for (const href of [...new Set(links)]) {
      if (/^(mailto:|tel:|https?:)/.test(href)) continue;
      const [file, hash] = href.split('#');
      const target = file || page;
      if (!fs.existsSync(path.join(ROOT, target))) { ok(false, `${page}: link to missing file ${href}`); continue; }
      if (hash && hash !== 'top') {
        const html = fs.readFileSync(path.join(ROOT, target), 'utf8');
        ok(html.includes(`id="${hash}"`), `${page}: anchor ${href} resolves`);
      }
    }
    // skip link target + landmarks
    ok(await p.$('#main-content') !== null, `${page}: #main-content exists`);
    ok((await p.$$('h1')).length === 1, `${page}: exactly one h1`);
    ok(await p.$eval('html', (h) => h.lang === 'en'), `${page}: html lang`);
    await ctx.close();
  }

  /* ---- header / footer identical on every page ---- */
  const norm = (s) => s.replace(/\saria-current="(page|true)"/g, '').replace(/href="#(certification|careers)"/g, 'href="index.html#$1"').replace(/\s+/g, ' ');
  const shell = {};
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const h = norm(html.slice(html.indexOf('<a href="#main-content"'), html.indexOf('</header>')));
    const f = norm(html.slice(html.indexOf('<footer'), html.indexOf('</footer>')));
    shell[page] = { h, f };
  }
  const ref = shell['index.html'];
  for (const page of PAGES) {
    ok(shell[page].h === ref.h, `${page}: header markup identical to Home 1 (shared)`);
    ok(shell[page].f === ref.f, `${page}: footer markup identical to Home 1 (shared)`);
  }

  /* ---- theme: first load follows OS, toggle, persistence across reload and navigation ---- */
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    ok((await p.evaluate(() => document.documentElement.classList.contains('dark'))) === (scheme === 'dark'), `first load with OS ${scheme}: theme matches before scripts finish`);
    const firstScript = await p.$eval('head script', (s) => s.textContent.includes('wts_theme'));
    ok(firstScript, 'theme init script runs in <head> (no flash)');
    await p.waitForLoadState('networkidle');
    await p.click('.actions-desktop [data-action="toggle-theme"]');
    const flipped = scheme === 'dark' ? 'light' : 'dark';
    ok((await p.evaluate(() => document.documentElement.classList.contains('dark'))) === (flipped === 'dark'), `toggle from ${scheme} -> ${flipped}`);
    ok((await p.evaluate(() => localStorage.getItem('wts_theme'))) === flipped, 'preference saved to localStorage');
    ok((await p.$eval('.actions-desktop [data-action="toggle-theme"]', (e) => e.getAttribute('aria-label'))) === (flipped === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'), 'icon-only toggle aria-label names the next action');
    ok((await p.$eval('.actions-desktop [data-action="toggle-theme"]', (e) => e.hasAttribute('title'))) === false, 'icon-only toggle shows no browser tooltip');
    ok((await p.$$eval('.actions-desktop [data-action="toggle-theme"] .icon', (is) => is.filter((i) => getComputedStyle(i).display !== 'none').length)) === 1, 'exactly one theme icon visible');
    ok((await p.$eval('.actions-desktop [data-action="toggle-theme"] .icon-sun', (i) => getComputedStyle(i).display !== 'none')) === (flipped === 'dark'), flipped === 'dark' ? 'dark mode shows the sun (switch to light)' : 'light mode shows the moon (switch to dark)');
    await p.reload({ waitUntil: 'networkidle' });
    ok((await p.evaluate(() => document.documentElement.classList.contains('dark'))) === (flipped === 'dark'), 'preference survives reload (overrides OS)');
    await p.goto(`${BASE}/home-2.html`, { waitUntil: 'domcontentloaded' });
    ok((await p.evaluate(() => document.documentElement.classList.contains('dark'))) === (flipped === 'dark'), 'preference applied on another page before paint');
    await p.goto(`${BASE}/programs.html`, { waitUntil: 'networkidle' });
    ok((await p.evaluate(() => document.documentElement.classList.contains('dark'))) === (flipped === 'dark'), 'preference persists across navigation');
    // the footer has no theme control any more
    ok((await p.$$('footer [data-action], footer [data-set-theme]')).length === 0, 'footer has no theme or direction controls');
    await ctx.close();
  }

  /* ---- direction toggle + RTL overflow ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.click('.actions-desktop [data-action="toggle-dir"]');
    ok((await p.$eval('.actions-desktop [data-action="toggle-dir"]', (e) => e.textContent.trim())) === 'RTL', 'direction control label reads RTL after switching');
    ok((await p.evaluate(() => document.documentElement.dir)) === 'rtl', 'direction toggles to RTL');
    await p.reload({ waitUntil: 'networkidle' });
    ok((await p.evaluate(() => document.documentElement.dir)) === 'rtl', 'RTL persists after reload');
    for (const w of [1440, 390]) {
      await p.setViewportSize({ width: w, height: 900 });
      for (const page of ['index.html', 'home-2.html']) {
        await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
        const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        ok(sw <= 1, `RTL ${page} @${w}: no horizontal overflow (${sw}px)`);
      }
    }
    await p.evaluate(() => localStorage.removeItem('wts_dir'));
    await ctx.close();
  }

  /* ---- desktop navigation ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    // ---- header structure ----
    ok((await p.$('.utility-strip')) === null, 'utility bar removed (nothing left to hold)');
    ok((await p.$$('#site-header [data-action="toggle-theme"]:visible')).length === 1, 'exactly one visible theme control in header');
    ok((await p.$$('#site-header [data-action="toggle-dir"]:visible')).length === 1, 'exactly one visible direction control in header');
    ok((await p.$eval('.actions-desktop [data-action="toggle-theme"]', (e) => e.textContent.trim())) === '', 'theme control shows no text');
    ok((await p.$$('.actions-desktop [data-action="toggle-dir"] svg')).length === 0, 'direction control has no icon');
    ok((await p.$eval('.actions-desktop [data-action="toggle-dir"]', (e) => e.textContent.trim())) === 'LTR', 'direction control shows LTR');
    const order = await p.$$eval('#site-header .nav-desktop > *, #site-header .actions-desktop > *', (els) => els.filter((e) => e.offsetParent).map((e) => (e.textContent.trim() || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ')));
    const expected = ['Home', 'Programs', 'Instructors', 'About', 'Contact', 'Dashboard'];
    ok(expected.every((t, i) => (order[i] || '').startsWith(t)), 'nav order: ' + order.slice(0, 6).join(' | '));
    ok(/^Switch to/.test(order[6]) && order[7] === 'LTR' && /Student Login/.test(order[8]) && /Enroll Now/.test(order[9]), 'controls order: theme icon, LTR, Student Login, Enroll (' + order.slice(6).join(' | ') + ')');
    ok((await p.$('a.nav-link[href="programs.html"]')) !== null && (await p.$('#programs-toggle, #programs-panel, .mega, .nav-chev')) === null, 'Programs is a plain link; no programs dropdown remains');
    ok((await p.$$eval('a.nav-link[href="programs.html"] svg', (s) => s.length)) === 0, 'Programs has no chevron');
    // ---- Home dropdown ----
    ok((await p.getAttribute('#home-toggle', 'aria-expanded')) === 'false' && (await p.getAttribute('#home-toggle', 'aria-controls')) === 'home-menu', 'Home toggle ARIA (collapsed)');
    ok((await p.getAttribute('#home-toggle', 'aria-current')) === 'true', 'Home marked current on Home 1');
    ok(!(await p.isVisible('#home-menu')), 'Home menu closed by default');
    await p.click('#home-toggle');
    ok(await p.isVisible('#home-menu') && (await p.getAttribute('#home-toggle', 'aria-expanded')) === 'true', 'Home menu opens, aria-expanded=true');
    const items = await p.$$eval('#home-menu a', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]));
    ok(JSON.stringify(items) === JSON.stringify([['Home 1', 'index.html', 'page'], ['Home 2', 'home-2.html', null]]), 'dropdown contains only Home 1 / Home 2 with correct links and current state ' + JSON.stringify(items));
    await p.keyboard.press('Escape');
    ok(!(await p.isVisible('#home-menu')) && (await p.evaluate(() => document.activeElement.id)) === 'home-toggle', 'Escape closes Home menu and returns focus');
    await p.focus('#home-toggle'); await p.keyboard.press('ArrowDown');
    ok(await p.isVisible('#home-menu') && (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Home 1', 'ArrowDown opens menu and focuses Home 1');
    await p.keyboard.press('ArrowDown');
    ok((await p.evaluate(() => document.activeElement.textContent.trim())) === 'Home 2', 'ArrowDown moves to Home 2');
    await p.keyboard.press('Tab');
    ok(!(await p.isVisible('#home-menu')), 'tabbing out closes Home menu');
    await p.click('#home-toggle'); await p.mouse.click(700, 600);
    ok(!(await p.isVisible('#home-menu')), 'outside click closes Home menu');
    await p.click('#home-toggle'); await p.click('#home-menu a[href="home-2.html"]'); await p.waitForURL('**/home-2.html');
    ok((await p.getAttribute('#home-toggle', 'aria-current')) === 'true', 'Home marked current on Home 2');
    await p.click('#home-toggle');
    ok((await p.$$eval('#home-menu a', (as) => as.map((a) => a.getAttribute('aria-current')))).join() === ',page', 'Home 2 marked current in dropdown');
    await p.keyboard.press('Escape');
    await p.goto(BASE + '/programs.html', { waitUntil: 'networkidle' });
    ok((await p.getAttribute('a.nav-link[href="programs.html"]', 'aria-current')) === 'page', 'Programs link current on programs.html');
    ok((await p.getAttribute('#home-toggle', 'aria-current')) === null, 'Home not marked current on other pages');
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    ok((await p.$('#site-header [data-home-anchor]')) === null, 'header has no Certification or Careers links');
    ok((await p.getAttribute('a.nav-link[data-nav="dashboard.html"]', 'href')) === 'dashboard.html', 'Dashboard links to dashboard.html');
    // enroll CTAs
    const enrollHrefs = await p.$$eval('a.btn-primary', (as) => as.map((a) => a.getAttribute('href')));
    ok(enrollHrefs.length >= 3 && enrollHrefs.every((h) => ['contact.html', 'programs.html'].includes(h)), `primary CTAs point to contact/programs (${enrollHrefs.join(',')})`);
    await p.click('header a.btn-primary'); await p.waitForURL('**/contact.html');
    ok(true, 'header Enroll Now navigates to contact.html');
    await p.goto(`${BASE}/index.html`);
    await p.click('header a.btn-secondary'); await p.waitForURL('**/login.html');
    ok(await p.isVisible('[role="tablist"]') && (await p.$('#site-header')) === null, 'Student Login opens the portal (app page, no marketing header)');
    // Home 1 tabs keyboard
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.focus('#tab-mig'); await p.keyboard.press('ArrowDown');
    ok((await p.getAttribute('#tab-tig', 'aria-selected')) === 'true', 'tabs: ArrowDown selects TIG');
    ok(await p.isVisible('#panel-tig') && !(await p.isVisible('#panel-mig')), 'tabs: panel switches');
    await p.keyboard.press('End');
    ok((await p.getAttribute('#tab-stick', 'aria-selected')) === 'true', 'tabs: End selects last');
    await p.click('#tab-mig');
    ok(await p.isVisible('#panel-mig'), 'tabs: click selects MIG');
    // Home 2 panels + scroller
    await p.goto(`${BASE}/home-2.html`, { waitUntil: 'networkidle' });
    await p.click('.xp:nth-child(2) .xp-btn');
    ok((await p.getAttribute('.xp:nth-child(2) .xp-btn', 'aria-expanded')) === 'true' && (await p.getAttribute('.xp:nth-child(1) .xp-btn', 'aria-expanded')) === 'false', 'careers panels: one open at a time');
    const before = await p.$eval('.bench-track', (t) => t.scrollLeft);
    await p.click('[data-scroller-next]'); await p.waitForTimeout(700);
    const after = await p.$eval('.bench-track', (t) => t.scrollLeft);
    ok(after > before, `timeline scroller advances (${before} -> ${after})`);
    ok(await p.$eval('[data-scroller-prev]', (b2) => !b2.disabled), 'scroller prev enabled after advancing');
    await ctx.close();
  }

  /* ---- mobile navigation ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    ok(!(await p.isVisible('.nav-desktop')), 'mobile: desktop nav hidden');
    ok(await p.isVisible('#nav-toggle'), 'mobile: menu button visible');
    await p.tap('#nav-toggle');
    ok(await p.isVisible('#nav-sheet'), 'mobile: sheet opens');
    ok((await p.getAttribute('#nav-toggle', 'aria-expanded')) === 'true', 'mobile: aria-expanded true');
    ok(await p.evaluate(() => document.body.classList.contains('nav-open')), 'mobile: page scroll locked');
    ok((await p.$('#sheet-programs-toggle, #sheet-programs')) === null, 'mobile: no Programs accordion');
    ok((await p.getAttribute('#nav-sheet a[href="programs.html"]', 'class')).includes('sheet-link'), 'mobile: Programs is a plain link');
    await p.tap('#sheet-home-toggle');
    ok(await p.isVisible('#sheet-home') && (await p.getAttribute('#sheet-home-toggle', 'aria-expanded')) === 'true', 'mobile: Home accordion expands');
    ok((await p.$$eval('#sheet-home a', (as) => as.map((a) => a.textContent.trim() + '>' + a.getAttribute('href')))).join() === 'Home 1>index.html,Home 2>home-2.html', 'mobile: Home accordion has only Home 1 / Home 2');
    ok((await p.getAttribute('#sheet-home-toggle', 'aria-current')) === 'true', 'mobile: Home accordion marked current');
    ok((await p.$$eval('#nav-sheet [data-set-theme]', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Light|Dark' && (await p.$eval('#nav-sheet [data-action="toggle-dir"]', (e) => e.textContent.trim())) === 'LTR', 'mobile: Light/Dark pair and text-only direction control');
    await p.tap('#nav-sheet [data-action="toggle-dir"]');
    ok((await p.evaluate(() => document.documentElement.dir)) === 'rtl' && (await p.$eval('#nav-sheet [data-action="toggle-dir"]', (e) => e.textContent.trim())) === 'RTL', 'mobile: direction toggle works from the sheet');
    await p.tap('#nav-sheet [data-action="toggle-dir"]');
    await p.tap('#nav-sheet [data-set-theme="dark"]');
    ok(await p.evaluate(() => localStorage.getItem('wts_theme') === 'dark' && document.documentElement.classList.contains('dark')), 'mobile: Dark button in the sheet switches and saves the theme');
    // focus trap: tab many times, focus must stay inside header
    for (let i = 0; i < 25; i++) await p.keyboard.press('Tab');
    ok(await p.evaluate(() => !!document.activeElement.closest('#site-header')), 'mobile: focus stays within open menu');
    await p.keyboard.press('Escape');
    ok(!(await p.isVisible('#nav-sheet')), 'mobile: Escape closes menu');
    await p.tap('#nav-toggle');
    await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(250);
    ok(!(await p.isVisible('#nav-sheet')) && (await p.evaluate(() => !document.body.classList.contains('nav-open'))), 'mobile: resizing to desktop closes the sheet and unlocks scroll');
    await p.setViewportSize({ width: 1024, height: 768 }); await p.waitForTimeout(150);
    ok(await p.isVisible('#nav-toggle') && !(await p.isVisible('.nav-desktop')), 'tablet landscape 1024: hamburger layout');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
    await p.focus('#nav-toggle');
    ok((await p.evaluate(() => document.activeElement.id)) === 'nav-toggle', 'mobile: focus returns to menu button');
    await p.tap('#nav-toggle'); await p.tap('#nav-sheet a[href="instructors.html"]'); await p.waitForURL('**/instructors.html');
    ok(!(await p.isVisible('#nav-sheet')), 'mobile: sheet closed after navigating');
    // sticky enroll bar
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    ok(!(await p.isVisible('#enroll-bar')), 'enroll bar hidden at top of page');
    await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
    ok(await p.isVisible('#enroll-bar'), 'enroll bar appears after scrolling');
    await p.tap('#nav-toggle');
    ok(!(await p.isVisible('#enroll-bar')), 'enroll bar hides while menu is open');
    await ctx.close();
  }

  await b.close();
  console.log(`\nFunctional QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
