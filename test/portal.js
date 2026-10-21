/**
 * Student portal QA (dashboard.html + login.html) at the 7 required viewports, light/dark, LTR/RTL.
 * Dashboard: app layout (no marketing shell), sidebar vs drawer, 4 destinations, consistent demo lab hours,
 *   demo enrollment that never claims submission, labelled demo exams, Logout -> login.html, brand -> index.html.
 * Login: Sign In / Register tabs, validation, show/hide password, honest "not connected" result, nothing sent or stored,
 *   viewport fit, brand -> index.html, no "back to website" link.
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };


const headingsStart = () => [...document.querySelectorAll('h1, h2, h3')].filter((h) => h.getBoundingClientRect().width > 0 && !h.closest('[hidden]')).map((h) => {
  const rtl = document.documentElement.dir === 'rtl';
  const range = document.createRange(); range.selectNodeContents(h);
  const t = range.getBoundingClientRect(), box = h.getBoundingClientRect(), cs = getComputedStyle(h);
  const gap = rtl ? box.right - t.right : t.left - box.left;
  const align = cs.textAlign;
  const okAlign = align === 'start' || align === (rtl ? 'right' : 'left');
  return { text: h.textContent.trim().slice(0, 30), ok: okAlign && gap < 4 };
}).filter((x) => !x.ok).map((x) => x.text);

(async () => {
  const b = await launch();
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const desktop = size.width >= 1024;
    for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
      const tag = `${vp} ${theme}/${dir}`;
      const full = theme === 'light' && dir === 'ltr'; // deep interaction checks once per viewport; layout checks everywhere
      const ctx = await b.newContext({ viewport: size, colorScheme: theme, hasTouch: !desktop });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      const errs = [], sent = [];
      p.on('pageerror', (e) => errs.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('request', (r) => { if (r.method() !== 'GET' || /api|auth|login\?|register/i.test(new URL(r.url()).pathname + new URL(r.url()).search)) sent.push(r.method() + ' ' + r.url()); });

      /* ================= DASHBOARD ================= */
      await p.goto(`${BASE}/dashboard.html`, { waitUntil: 'load', timeout: 60000 });
      const base = await p.evaluate(() => ({
        marketing: !!document.getElementById('site-header') || !!document.getElementById('site-footer'),
        backLink: [...document.querySelectorAll('a, button')].some((e) => /(back|return) to (the )?website/i.test(e.textContent)),
        brand: [...document.querySelectorAll('a.brand')].map((a) => a.getAttribute('href')),
        logout: [...document.querySelectorAll('a.app-logout')].filter((a) => a.offsetParent !== null).map((a) => a.getAttribute('href')),
        nav: [...document.querySelectorAll('.app-nav a')].map((a) => a.textContent.trim() + '>' + a.getAttribute('href')),
        over: document.documentElement.scrollWidth - innerWidth,
        dark: document.documentElement.classList.contains('dark'), dir: document.documentElement.dir
      }));
      ok(!base.marketing, `dashboard ${tag}: no marketing header or footer`);
      ok(!base.backLink, `dashboard ${tag}: no "back/return to website" link`);
      ok(base.brand.length > 0 && base.brand.every((h) => h === 'index.html'), `dashboard ${tag}: brand links to index.html`);
      ok(base.logout.length >= 1 && base.logout.every((h) => h === 'login.html'), `dashboard ${tag}: visible Logout -> login.html`);
      ok(base.nav.join('|') === 'Overview>#overview|Certification Programs>#programs|Lab Hours>#lab-hours|Exam Results>#exams', `dashboard ${tag}: nav ${base.nav.join('|')}`);
      ok(base.over <= 0, `dashboard ${tag}: no horizontal overflow (${base.over})`);
      { const bad = await p.evaluate(headingsStart); ok(bad.length === 0, `dashboard ${tag}: headings start-aligned ${bad.join(' / ')}`); }
      ok(base.dark === (theme === 'dark') && base.dir === dir, `dashboard ${tag}: theme and direction applied`);

      // lab-hour consistency (every place the figures appear)
      const lab = await p.evaluate(() => {
        const nums = (k) => [...document.querySelectorAll(`[data-lab="${k}"]`)].map((e) => +e.textContent);
        const bars = [...document.querySelectorAll('[data-lab-progress]')].map((b) => ({ now: +b.getAttribute('aria-valuenow'), max: +b.getAttribute('aria-valuemax'), w: parseFloat(b.querySelector('i').style.width) }));
        return { c: nums('completed'), r: nums('required'), rem: nums('remaining'), pct: nums('percent'), bars };
      });
      const c = lab.c[0], r = lab.r[0], rem = lab.rem[0];
      ok(lab.c.every((x) => x === c) && lab.r.every((x) => x === r) && lab.rem.every((x) => x === rem), `dashboard ${tag}: lab figures identical wherever shown`);
      ok(c + rem === r && c > 0 && rem >= 0, `dashboard ${tag}: completed ${c} + remaining ${rem} = required ${r}`);
      ok(lab.bars.every((x) => x.now === c && x.max === r && Math.abs(x.w - Math.round((c / r) * 100)) <= 0.5) && lab.pct.every((x) => x === Math.round((c / r) * 100)), `dashboard ${tag}: progress bars and percent match ${c}/${r}`);

      // navigation: desktop sidebar vs drawer
      const sideVisible = async () => p.$eval('#app-nav', (a) => { const r = a.getBoundingClientRect(); return getComputedStyle(a).visibility !== 'hidden' && r.right > 0 && r.left < innerWidth; });
      if (desktop) {
        ok(await sideVisible() && !(await p.isVisible('[data-drawer-open]')), `dashboard ${tag}: persistent sidebar, no menu button`);
        for (const [view, title] of [['programs', 'Certification Programs'], ['lab-hours', 'Lab Hours'], ['exams', 'Exam Results'], ['overview', 'Overview']]) {
          await p.click(`.app-nav a[href="#${view}"]`); await p.waitForTimeout(120);
          const st = await p.evaluate((v) => ({ shown: [...document.querySelectorAll('[data-view]')].filter((s) => !s.hidden).map((s) => s.id), cur: document.querySelector('.app-nav a[aria-current="page"]').getAttribute('href'), title: document.querySelector('[data-view-title]').textContent, hash: location.hash }), view);
          ok(st.shown.join() === view && st.cur === '#' + view && st.title === title && st.hash === '#' + view, `dashboard ${tag}: nav -> ${view}`);
        }
      } else {
        ok(!(await sideVisible()) && await p.isVisible('[data-drawer-open]'), `dashboard ${tag}: sidebar hidden, menu button shown`);
        await p.click('[data-drawer-open]'); await p.waitForTimeout(300);
        const open = await p.evaluate(() => {
          const a = document.getElementById('app-nav').getBoundingClientRect();
          return { vis: a.width > 0 && a.left >= -1 && a.right <= innerWidth + 1, left: Math.round(a.left), right: Math.round(a.right), vw: innerWidth,
            exp: document.querySelector('[data-drawer-open]').getAttribute('aria-expanded'), lock: getComputedStyle(document.body).overflow, inert: document.querySelector('[data-app-body]').hasAttribute('inert'), focusIn: !!document.activeElement.closest('#app-nav') };
        });
        ok(open.vis && open.exp === 'true', `dashboard ${tag}: drawer opens`);
        ok(dir === 'rtl' ? open.right >= open.vw - 1 : open.left <= 1, `dashboard ${tag}: drawer opens from the ${dir === 'rtl' ? 'right' : 'left'} (${open.left}-${open.right})`);
        ok(open.lock === 'hidden' && open.inert && open.focusIn, `dashboard ${tag}: page locked and inert behind the drawer, focus inside`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(260);
        ok(!(await sideVisible()) && (await p.evaluate(() => document.activeElement.matches('[data-drawer-open]'))), `dashboard ${tag}: Escape closes the drawer and returns focus`);
        ok((await p.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden' && !(await p.evaluate(() => document.querySelector('[data-app-body]').hasAttribute('inert'))), `dashboard ${tag}: scrolling and interaction restored`);
        await p.click('[data-drawer-open]'); await p.waitForTimeout(260);
        await p.mouse.click(dir === 'rtl' ? 8 : size.width - 8, size.height / 2); await p.waitForTimeout(260);
        ok(!(await sideVisible()), `dashboard ${tag}: outside click closes the drawer`);
        await p.click('[data-drawer-open]'); await p.waitForTimeout(260);
        await p.click('[data-drawer-close]'); await p.waitForTimeout(260);
        ok(!(await sideVisible()), `dashboard ${tag}: close button closes the drawer`);
        for (const [view, title] of [['programs', 'Certification Programs'], ['lab-hours', 'Lab Hours'], ['exams', 'Exam Results'], ['overview', 'Overview']]) {
          await p.click('[data-drawer-open]'); await p.waitForTimeout(260);
          await p.click(`.app-nav a[href="#${view}"]`); await p.waitForTimeout(300);
          const st = await p.evaluate(() => ({ shown: [...document.querySelectorAll('[data-view]')].filter((s) => !s.hidden).map((s) => s.id), title: document.querySelector('[data-view-title]').textContent, locked: document.body.classList.contains('drawer-open') }));
          ok(st.shown.join() === view && st.title === title && !st.locked, `dashboard ${tag}: drawer nav -> ${view} and closes`);
        }
      }
      ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `dashboard ${tag}: no overflow after navigation`);

      if (full) {
        // exam table + demo labelling on every view
        await p.goto(`${BASE}/dashboard.html#exams`, { waitUntil: 'load' });
        const ex = await p.$$eval('[data-exams] tbody tr', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
        ok(ex.length === 3 && /Demo result/.test(ex[0]) && /Pending/.test(ex[1]) && /Not available/.test(ex[2]), `dashboard ${vp}: exam rows with demo / pending / not available states`);
        ok(!(await p.evaluate(() => /\b(\d{1,3}\s?%|score|passed|failed|certified)\b/i.test(document.querySelector('#exams').textContent))), `dashboard ${vp}: no invented scores or certification outcomes`);
        ok(await p.$$eval('#exams .status', (ss) => ss.length === 3 && ss.every((s) => { const c = getComputedStyle(s); return c.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(c.borderTopWidth) > 0; })), `dashboard ${vp}: every status chip is styled (fill or border)`);
        ok(await p.evaluate(() => [...document.querySelectorAll('[data-view]')].every((v) => /demo|sample/i.test(v.textContent))), `dashboard ${vp}: every view labels its data as demo/sample`);
        // enrollment demo
        await p.goto(`${BASE}/dashboard.html#programs`, { waitUntil: 'load' });
        ok((await p.$$('[data-enroll]')).length === 3, `dashboard ${vp}: three sample options with Enroll`);
        ok(await p.evaluate(() => /Processes and programs are not the same thing/.test(document.body.textContent) && [...document.querySelectorAll('.prog-k')].every((k) => /Sample option/.test(k.textContent))), `dashboard ${vp}: processes distinguished from official programs; options labelled sample`);
        ok(await p.evaluate(() => [...document.querySelectorAll('.prog a')].map((a) => a.getAttribute('href')).join() === 'programs.html#mig,programs.html#tig,programs.html#stick'), `dashboard ${vp}: View program links go to the real program sections`);
        await p.click('[data-enroll="tig"]'); await p.waitForTimeout(150);
        const msg = await p.textContent('[data-enroll-status]');
        ok(/Demo enrollment selected/.test(msg) && /No real enrollment has been submitted/.test(msg), `dashboard ${vp}: enroll shows the demo message`);
        ok(!/(confirmed|received|success|you are enrolled|enrolled successfully)/i.test(msg), `dashboard ${vp}: no claim of real enrollment`);
        ok(await p.evaluate(() => document.activeElement.matches('[data-enroll-clear]')), `dashboard ${vp}: focus moves to Clear selection`);
        await p.click('.app-nav a[href="#overview"]').catch(async () => { await p.click('[data-drawer-open]'); await p.waitForTimeout(250); await p.click('.app-nav a[href="#overview"]'); });
        await p.waitForTimeout(200);
        ok(/TIG \/ GTAW track/.test(await p.textContent('[data-enroll-summary]')) && /Nothing has been submitted/.test(await p.textContent('[data-enroll-summary]')), `dashboard ${vp}: overview reflects the demo selection`);
        ok(await p.evaluate(() => Object.keys(localStorage).every((k) => k === 'wts_theme' || k === 'wts_dir') && sessionStorage.length === 0), `dashboard ${vp}: demo state not stored`);
        // logout + brand navigation
        await p.locator('a.app-logout:visible').first().click(); await p.waitForURL('**/login.html');
        ok(true, `dashboard ${vp}: Logout navigates to login.html`);
        await p.goto(`${BASE}/dashboard.html`, { waitUntil: 'load' });
        if (!desktop) { await p.click('[data-drawer-open]'); await p.waitForTimeout(250); }
        await p.click('a.app-brand'); await p.waitForURL('**/index.html');
        ok(true, `dashboard ${vp}: brand navigates to index.html`);
      }

      /* ================= LOGIN ================= */
      await p.goto(`${BASE}/login.html`, { waitUntil: 'load', timeout: 60000 });
      const lb = await p.evaluate(() => ({
        marketing: !!document.getElementById('site-header') || !!document.getElementById('site-footer'),
        backLink: [...document.querySelectorAll('a, button')].some((e) => /(back|return) to (the )?website/i.test(e.textContent)),
        brand: [...document.querySelectorAll('a.brand')].map((a) => a.getAttribute('href')),
        over: document.documentElement.scrollWidth - innerWidth,
        card: (() => { const r = document.querySelector('.portal-card').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })(),
        vh: innerHeight
      }));
      ok(!lb.marketing && !lb.backLink, `login ${tag}: no marketing shell, no back-to-website link`);
      ok(lb.brand.length === 1 && lb.brand[0] === 'index.html', `login ${tag}: brand links to index.html`);
      ok(lb.over <= 0, `login ${tag}: no horizontal overflow (${lb.over})`);
      { const bad = await p.evaluate(headingsStart); ok(bad.length === 0, `login ${tag}: headings start-aligned ${bad.join(' / ')}`); }
      if (desktop && size.height >= 700) ok(lb.card.top >= 0 && lb.card.bottom <= lb.vh, `login ${tag}: sign-in card fits the viewport (${Math.round(lb.card.top)}-${Math.round(lb.card.bottom)} of ${lb.vh})`);
      // every control reachable on short screens
      for (const sel of ['#si-email', '#si-pass', '#panel-signin .auth-submit']) {
        await p.locator(sel).scrollIntoViewIfNeeded();
        const vis = await p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
        ok(vis, `login ${tag}: ${sel} reachable and fully visible`);
      }
      // register tab reachable + its controls
      await p.click('#tab-register'); await p.waitForTimeout(80);
      ok(await p.isVisible('#panel-register') && !(await p.isVisible('#panel-signin')), `login ${tag}: Register tab shows the register form`);
      await p.locator('#panel-register .auth-submit').scrollIntoViewIfNeeded();
      ok(await p.$eval('#panel-register .auth-submit', (e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }), `login ${tag}: Register button reachable`);
      ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `login ${tag}: register form causes no overflow`);
      await p.click('#tab-signin');

      if (full) {
        // sign-in validation
        await p.click('#panel-signin .auth-submit'); await p.waitForTimeout(100);
        ok((await p.getAttribute('#si-email', 'aria-invalid')) === 'true' && (await p.getAttribute('#si-pass', 'aria-invalid')) === 'true', `login ${vp}: empty sign-in flags both fields`);
        ok(await p.evaluate(() => document.activeElement.id === 'si-email'), `login ${vp}: focus moves to the first invalid field`);
        ok(!(await p.isVisible('#panel-signin .auth-result')), `login ${vp}: no result message on invalid submit`);
        await p.fill('#si-email', 'not-an-email'); await p.press('#si-email', 'Tab');
        ok(/name@example\.com/.test(await p.textContent('#si-email-err')), `login ${vp}: email format explained`);
        await p.fill('#si-email', 'student@example.com'); await p.fill('#si-pass', 'any-password-1');
        ok((await p.getAttribute('#si-email', 'aria-invalid')) === 'false', `login ${vp}: error clears when fixed`);
        // show/hide password
        await p.click('[data-pw-toggle="si-pass"]');
        ok((await p.getAttribute('#si-pass', 'type')) === 'text' && (await p.getAttribute('[data-pw-toggle="si-pass"]', 'aria-pressed')) === 'true', `login ${vp}: show password`);
        await p.click('[data-pw-toggle="si-pass"]');
        ok((await p.getAttribute('#si-pass', 'type')) === 'password' && (await p.getAttribute('[data-pw-toggle="si-pass"]', 'aria-label')) === 'Show password', `login ${vp}: hide password`);
        await p.check('input[name="remember"]');
        await p.click('#panel-signin .auth-submit'); await p.waitForTimeout(150);
        const sr = await p.textContent('#panel-signin .auth-result');
        ok(/not connected/.test(sr) && /not been signed in/.test(sr), `login ${vp}: sign-in explains it is not connected`);
        ok(!/(welcome|success|signed in successfully|logged in)/i.test(sr.replace(/not been signed in/, '')), `login ${vp}: no success claim on sign-in`);
        ok(/login\.html$/.test(p.url()), `login ${vp}: no navigation on sign-in`);
        // register validation
        await p.click('[data-auth-switch="register"]');
        ok(await p.isVisible('#panel-register') && (await p.evaluate(() => document.activeElement.id)) === 'rg-name', `login ${vp}: "Create an account" switches and focuses the first field`);
        await p.fill('#rg-name', 'Sam Rivera'); await p.fill('#rg-email', 'sam@example.com'); await p.fill('#rg-pass', 'longpassword'); await p.fill('#rg-pass2', 'different1');
        await p.click('#panel-register .auth-submit'); await p.waitForTimeout(100);
        ok(/do not match/.test(await p.textContent('#rg-pass2-err')) && !(await p.isVisible('#panel-register .auth-result')), `login ${vp}: mismatched passwords blocked`);
        await p.fill('#rg-pass', 'short'); await p.press('#rg-pass', 'Tab');
        ok(/at least 8/.test(await p.textContent('#rg-pass-err')), `login ${vp}: short password explained`);
        await p.fill('#rg-pass', 'longpassword'); await p.fill('#rg-pass2', 'longpassword');
        await p.click('#panel-register .auth-submit'); await p.waitForTimeout(150);
        const rr = await p.textContent('#panel-register .auth-result');
        ok(/not connected/.test(rr) && /no account has been created/.test(rr), `login ${vp}: register explains no account was created`);
        ok(!/(welcome|success|account created|registered successfully)/i.test(rr), `login ${vp}: no success claim on register`);
        await p.click('[data-auth-switch="signin"]');
        ok(await p.isVisible('#panel-signin') && !(await p.isVisible('#panel-register .auth-result')), `login ${vp}: switch back to Sign In`);
        // nothing stored or sent
        const stored = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) + document.cookie);
        ok(!/example\.com|longpassword|any-password|Sam Rivera/.test(stored), `login ${vp}: no form values in storage or cookies`);
        ok(sent.length === 0, `login ${vp}: no request sent ${sent.join(' | ')}`);
        // brand
        await p.click('a.app-brand'); await p.waitForURL('**/index.html');
        ok(true, `login ${vp}: brand navigates to index.html`);
      }
      ok(errs.length === 0, `${tag}: no console errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  }
  // the marketing site links to the new dashboard
  {
    const ctx = await b.newContext({ viewport: VIEWPORTS['desktop-1440'] });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await p.click('a.nav-link[data-nav="dashboard.html"]'); await p.waitForURL('**/dashboard.html');
    ok(await p.isVisible('.app-side'), 'header Dashboard link opens the dashboard');
    await ctx.close();
  }
  await b.close();
  console.log(`\nPortal QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
