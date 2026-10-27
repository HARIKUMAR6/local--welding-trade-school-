/**
 * Contact page QA:
 *  - exactly five sections; no invented phone, email, address or coordinates
 *  - map: a real, interactive OpenStreetMap embed of a general area (Chennai), with NO pin and a label saying it is not
 *    the school's location; pan/zoom works; a fallback with an external link appears when the provider cannot load
 *  - enquiry form: labels, validation, error summary, focus management, and it never claims delivery or makes a request
 *  - unique local photos, shared inner-page hero height, light/dark, LTR/RTL, no overflow, all 7 viewports
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (process.argv.includes('--verbose')) console.log('  ok  ', m); } else { fails++; console.log('FAIL', m); } };

const html = fs.readFileSync(path.join(ROOT, 'contact.html'), 'utf8');
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'partials/location.json'), 'utf8'));

// ---- structure & honesty ----
ok((main.match(/<section\b/g) || []).length === 5, 'exactly five sections including the hero');
ok(main.includes('class="inner-hero '), 'hero uses the shared .inner-hero rule');
for (const id of ['ways', 'enquiry', 'location', 'visit']) ok(main.includes(`id="${id}"`), `section #${id} present`);
ok(!/href="(tel|mailto):/i.test(main), 'no telephone or email links');
ok(!/\+?\d[\d\s().-]{7,}\d/.test(text), 'no phone-number-like text');
ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text), 'no email address in the page');
ok(!/\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Drive|Way|Boulevard|Blvd)\b/.test(text), 'no street address text');
ok(!/\b(opening hours|open (daily|weekdays|mon)|mon(day)?\s*[-–]|tours?|campus visits?|book a visit)\b/i.test(text),'no unverified hours, tours or visit offers');
ok(main.includes('data-map-state="general"') && main.includes('openstreetmap.org/export/embed.html'), 'general OpenStreetMap embed present');
ok(!/marker=|mlat=/.test(main), 'map has no location pin');
ok(!('address' in cfg) && !('lat' in cfg), 'no school address or coordinates recorded');
ok(/Chennai, India/.test(text) && /does not (show|mark) (where the school is|the school.s location)/.test(text), 'map is labelled as a general map, not the school location');
ok(!/(school|we) (is|are) (located|based) in/i.test(text), 'page never claims where the school is');

// ---- photos ----
const imgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
ok(imgs.length === 2, `2 photos on the page (${imgs.length})`);
ok(imgs.every((s) => s.startsWith('assets/images/contact/ct-') && fs.existsSync(path.join(ROOT, s))), 'photos are local, in assets/images/contact');
const others = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !['contact.html'].includes(f)).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('');
ok(imgs.every((s) => !others.includes('contact/' + path.basename(s, '.jpg'))), 'no Contact photo appears on another page');
const sources = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/image-manifest.json'), 'utf8'))).map((m) => m.file);
ok(new Set(sources).size === sources.length, 'every photo on the site comes from a different source image');

(async () => {
  const b = await launch();

  // ---- form behaviour ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [], posts = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('request', (r) => { if (r.method() !== 'GET') posts.push(r.method() + ' ' + r.url()); });
    await p.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
    ok((await p.getAttribute('a.nav-link[href="contact.html"]', 'aria-current')) === 'page', 'Contact is the current page in the header');
    // every control has a visible label
    const unlabeled = await p.$$eval('#enquiry-form input, #enquiry-form select, #enquiry-form textarea', (els) => els.filter((e) => !document.querySelector(`label[for="${e.id}"]`)).map((e) => e.id));
    ok(unlabeled.length === 0, 'every form control has a label ' + unlabeled.join(','));
    ok((await p.getAttribute('#f-email', 'type')) === 'email' && (await p.getAttribute('#f-phone', 'type')) === 'tel', 'suitable input types (email, tel)');
    // empty submit
    await p.click('#enquiry-form button[type=submit]');
    ok(await p.isVisible('#form-errors'), 'empty submit shows the error summary');
    ok((await p.evaluate(() => document.activeElement.id)) === 'form-errors', 'focus moves to the error summary');
    const invalid = await p.$$eval('[aria-invalid="true"]', (els) => els.map((e) => e.id));
    ok(invalid.join() === 'f-name,f-email,f-topic,f-msg', 'required fields flagged; optional phone is not (' + invalid.join() + ')');
    ok((await p.$$eval('[data-error-list] a', (a) => a.length)) === 4, 'summary lists 4 problems with links');
    ok((await p.$('#form-result')) === null, 'no result/success panel exists in the form');
    await p.click('[data-error-list] a[href="#f-email"]');
    ok((await p.evaluate(() => document.activeElement.id)) === 'f-email', 'summary link moves focus to its field');
    // specific messages
    await p.fill('#f-email', 'not-an-email'); await p.press('#f-email', 'Tab');
    ok(/like name@example\.com/.test(await p.textContent('#f-email-err')), 'invalid email explains the expected format');
    await p.fill('#f-phone', 'call me'); await p.press('#f-phone', 'Tab');
    ok((await p.getAttribute('#f-phone', 'aria-invalid')) === 'true', 'invalid optional phone is flagged when filled in');
    await p.fill('#f-msg', 'Too short'); await p.press('#f-msg', 'Tab');
    ok(/at least 20 characters/.test(await p.textContent('#f-msg-err')), 'short message explains the minimum length');
    // fix everything: errors clear as you type
    await p.fill('#f-name', 'Sam Rivera');
    await p.fill('#f-email', 'sam@example.com');
    ok((await p.getAttribute('#f-email', 'aria-invalid')) === 'false' && !(await p.isVisible('#f-email-err')), 'error clears as soon as the field is fixed');
    await p.fill('#f-phone', '');
    await p.selectOption('#f-topic', { index: 2 });
    await p.fill('#f-msg', 'Which process should I learn first if I am new to welding?');
    ok((await p.textContent('[data-count]')) === String('Which process should I learn first if I am new to welding?'.length), 'character counter updates');
    await p.click('#enquiry-form button[type=submit]');
    ok(!(await p.isVisible('#form-errors')), 'valid submit clears the error summary');
    const formText = await p.textContent('#enquiry');
    ok(!/demonstration|not connected|has not been sent|not been sent/i.test(formText), 'no demonstration / not-sent message anywhere in the enquiry section');
    ok(!/thank you|we.ll be in touch|has been sent|received your/i.test(formText), 'section never claims delivery');
    ok(posts.length === 0, 'no request is sent anywhere ' + posts.join(' | '));
    ok(p.url().endsWith('/contact.html'), 'page does not navigate on submit');
    await p.click('#enquiry-form button[type=reset]');
    ok((await p.$$eval('[aria-invalid="true"]', (e) => e.length)) === 0, 'clear resets fields and errors');
    // regression: clicking Submit while focused in an invalid field must still submit (blur error must not swallow the click)
    await p.fill('#f-email', 'nope'); await p.fill('#f-msg', 'short');
    await p.click('#enquiry-form button[type=submit]'); await p.waitForTimeout(200);
    ok(await p.isVisible('#form-errors') && (await p.$$eval('[aria-invalid="true"]', (e) => e.length)) === 4, 'submit from a focused invalid field still validates the whole form');
    await p.click('#enquiry-form button[type=reset]');
    // keyboard: tab order reaches every control
    await p.focus('#f-name');
    const order = [];
    for (let i = 0; i < 7; i++) { order.push(await p.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim())); await p.keyboard.press('Tab'); }
    ok(order.slice(0, 5).join() === 'f-name,f-email,f-phone,f-topic,f-msg', 'keyboard order follows the form (' + order.join(' > ') + ')');
    ok(errs.length === 0, 'no console errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- live general map: interactive at desktop and mobile; fallback when the provider is blocked ----
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1024 });
    const p = await ctx.newPage();
    const tileZooms = new Set();
    p.on('request', (r) => { const m = r.url().match(/tile\.openstreetmap\.org\/(\d+)\//); if (m) tileZooms.add(+m[1]); });
    await p.goto(`${BASE}/contact.html`, { waitUntil: 'load', timeout: 60000 });
    await p.$eval('#location', (e) => e.scrollIntoView());
    const frame = await p.waitForSelector('iframe.ct-map-frame');
    ok(/Not the school/.test(await frame.getAttribute('title')), `map iframe title names it a general map (${vp.width})`);
    const box = await frame.boundingBox();
    ok(box.width > 280 && box.height > 280, `map is large enough to use (${Math.round(box.width)}x${Math.round(box.height)} at ${vp.width})`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `map causes no horizontal overflow (${vp.width})`);
    let controls = false, zoomed = false, panned = false;
    try {
      const fr = await frame.contentFrame();
      await fr.waitForSelector('#map, .maplibregl-map, .leaflet-container', { timeout: 20000 });
      const zoomIn = await fr.waitForSelector('button.maplibregl-ctrl-zoom-in, a.leaflet-control-zoom-in, [aria-label="Zoom In"], [aria-label="Zoom in"]', { timeout: 20000 });
      controls = !!zoomIn;
      await p.waitForTimeout(2500);
      const before = Math.max(0, ...tileZooms);
      await zoomIn.click();
      await p.waitForTimeout(3500);
      zoomed = Math.max(0, ...tileZooms) > before;
      // pan: drag the map and expect new tiles at the current zoom
      const n0 = tileZooms.size; const reqs0 = [];
      const onReq = (r) => { if (/tile\.openstreetmap/.test(r.url())) reqs0.push(r.url()); };
      p.on('request', onReq);
      const fb = await frame.boundingBox();
      await p.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
      await p.mouse.down(); await p.mouse.move(fb.x + fb.width / 2 - 220, fb.y + fb.height / 2 - 120, { steps: 12 }); await p.mouse.up();
      await p.waitForTimeout(3000);
      panned = reqs0.length > 0;
      p.off('request', onReq);
      void n0;
    } catch (e) { /* reported below */ }
    ok(controls, `OpenStreetMap embed loads with zoom controls (${vp.width})`);
    ok(zoomed, `Zoom In loads tiles at a deeper zoom level (${vp.width})`);
    ok(panned, `dragging the map pans it and loads new tiles (${vp.width})`);
    ok(await p.$eval('.ct-map-cap a[href*="openstreetmap.org/#map="]', (a) => a.target === '_blank'), 'external "Open in OpenStreetMap" link present');
    ok(await p.$eval('.ct-map-cap a[href*="openstreetmap.org/copyright"]', () => true), 'OpenStreetMap attribution link present');
    await ctx.close();
  }

  // ---- layout across viewports, themes and directions ----
  const heights = {};
  for (const name of ['desktop-1440', 'laptop-1366', 'tablet-landscape-1024', 'tablet-portrait-768', 'mobile-390', 'mobile-small-320', 'mobile-landscape-844']) {
    const size = VIEWPORTS[name];
    for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
      const ctx = await b.newContext({ viewport: size, colorScheme: theme, hasTouch: size.width < 1024 });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/contact.html`, { waitUntil: 'load', timeout: 60000 });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); } });
      await p.waitForTimeout(600);
      await p.evaluate(() => window.scrollTo(0, 0));
      const m = await p.evaluate(() => {
        const hero = document.querySelector('.inner-hero');
        const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;min-height:var(--inner-hero-h)'; document.body.appendChild(probe);
        const rule = probe.getBoundingClientRect().height; probe.remove();
        const form = document.querySelector('#enquiry-form').getBoundingClientRect();
        return {
          h: Math.round(hero.getBoundingClientRect().height), rule: Math.round(rule),
          cta: Math.round(hero.querySelector('.btn-primary').getBoundingClientRect().bottom), vh: innerHeight,
          over: document.documentElement.scrollWidth - innerWidth, formOver: form.right > innerWidth + 1 || form.left < -1,
          broken: [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 0 && !(i.complete && i.naturalWidth > 0)).length,
          dark: document.documentElement.classList.contains('dark'), dir: document.documentElement.dir,
          labelAlign: getComputedStyle(document.querySelector('.ct-field label')).textAlign
        };
      });
      heights[name] = m.h;
      const tag = `${name} ${theme}/${dir}`;
      ok(m.over <= 0 && !m.formOver, `${tag}: no horizontal overflow`);
      ok(m.broken === 0, `${tag}: images loaded`);
      ok(m.dark === (theme === 'dark') && m.dir === dir, `${tag}: theme and direction applied`);
      ok(m.labelAlign === 'start' || m.labelAlign === (dir === 'rtl' ? 'right' : 'left'), `${tag}: form labels start-aligned`);
      const shortLandscape = size.height <= 520 && size.width > size.height;
      if (!shortLandscape && size.width >= 768) ok(Math.abs(m.h - m.rule) <= 2, `${tag}: hero ${m.h}px equals the shared rule ${m.rule}px`);
      else if (!shortLandscape) ok(m.h >= m.rule - 1, `${tag}: hero ${m.h}px at least the shared rule`);
      if (size.width >= 768) ok(m.cta <= m.vh, `${tag}: hero CTA in the first screen (${m.cta}/${m.vh})`);
      await ctx.close();
    }
  }
  console.log('hero heights:', JSON.stringify(heights));
  await b.close();
  console.log(`\nContact QA: ${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})();
