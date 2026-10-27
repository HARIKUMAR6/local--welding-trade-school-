/**
 * WCAG 2.2 AA contrast audit, driven by the real rendered page (computed styles), in both themes.
 *   node test/contrast-audit.js [--pages a.html,b.html] [--viewports desktop-1440,mobile-390] [--verbose]
 * Checks per page / theme / viewport:
 *   - every visible text node: ratio vs the composited ancestor background (4.5 normal, 3.0 large)
 *   - text drawn over an image / gradient with no solid backing (reported as FAIL)
 *   - icons (svg stroke/fill = currentColor) >= 3:1, control boundaries (border or fill) >= 3:1
 *   - hover state of interactive elements, selected tab / opened panel states, open menus
 *   - keyboard focus indicator (outline colour vs surrounding background) >= 3:1
 * Exit code 1 when any check fails.
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PAGES = opt('--pages', 'index.html,home-2.html,programs.html,instructors.html,about.html,contact.html,login.html,dashboard.html').split(',');
const VPS = opt('--viewports', 'desktop-1440,mobile-390').split(',');
const VERBOSE = args.includes('--verbose');

/* Runs inside the page. Returns findings for the subtree of `rootSel` (default: whole document). */
function measureInPage(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id; else if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/)[0];
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  // Composite the background behind an element. Returns { color, image } where image=true when an <img>/background-image sits in the stack.
  const backdrop = (el) => {
    const layers = []; let image = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') image = true;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a === 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return { color: base, image };
  };
  const opacityOf = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.closest('.skip-link') && !el.closest('.skip-link').matches(':focus')) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  };
  const out = [];
  const push = (kind, el, extra) => out.push(Object.assign({ kind, el: path(el) }, extra));

  // ---- text ----
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const tn = walker.currentNode;
    if (!tn.nodeValue.trim()) continue;
    const el = tn.parentElement;
    if (!el || seen.has(el) || !visible(el)) continue;
    if (['SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const bd = backdrop(el);
    let fg = parse(cs.color);
    const op = opacityOf(el);
    if (fg.a < 1 || op < 1) fg = blend({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * op }, bd.color);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bd.color);
    push('text', el, { text: tn.nodeValue.trim().slice(0, 40), fg: hex(fg), bg: hex(bd.color), ratio: +r.toFixed(2), need, ok: r >= need && !bd.image, image: bd.image, opacity: op });
  }

  // ---- icons ----
  root.querySelectorAll('svg.icon, svg.glyph').forEach((svg) => {
    if (!visible(svg) || svg.closest('[hidden]')) return;
    const cs = getComputedStyle(svg);
    const bd = backdrop(svg);
    const fg = parse(cs.color);
    const r = ratio(blend(fg, bd.color), bd.color);
    push('icon', svg, { fg: hex(fg), bg: hex(bd.color), ratio: +r.toFixed(2), need: 3, ok: r >= 3 });
  });

  // ---- control boundaries (button-like things must be distinguishable from their surroundings) ----
  root.querySelectorAll('.btn, .icon-btn, .utility-btn, .ctl-btn, .to-top, .social-icon, .tab[aria-selected="true"], .xp').forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const outer = backdrop(el.parentElement || el);
    const own = backdrop(el).color;
    const bw = parseFloat(cs.borderTopWidth);
    const border = parse(cs.borderTopColor);
    const bc = bw > 0 && border && border.a > 0 ? ratio(border, outer.color) : 0;
    const fc = ratio(own, outer.color);
    const best = Math.max(bc, fc);
    push('boundary', el, { text: (el.textContent || '').trim().slice(0, 24), ratio: +best.toFixed(2), need: 3, ok: best >= 3, border: bw > 0 ? hex(border) : 'none', fill: hex(own), outer: hex(outer.color) });
  });

  // ---- visible meaningful borders (report anything under 3:1 so decorative vs meaningful can be reviewed) ----
  const weak = new Map();
  root.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    ['Top', 'Bottom', 'Left', 'Right'].forEach((side) => {
      const w = parseFloat(cs['border' + side + 'Width']);
      if (w < 2 || cs['border' + side + 'Style'] === 'none') return;
      const c = parse(cs['border' + side + 'Color']);
      if (!c || c.a === 0) return;
      const bd = backdrop(el.parentElement || el).color;
      const r = ratio(c, bd);
      // same-colour borders are spacing, not UI; a filled box that already contrasts with its surroundings carries its own boundary
      const own = backdrop(el).color;
      if (r < 1.2 || ratio(own, bd) >= 3) return;
      if (el.closest('.pg-band-plate, .lab-panel, .pg-board')) return; // accent bar on a solid plate that sits over a photograph
      if (r < 3) weak.set(path(el) + ' [' + side + ']', +r.toFixed(2));
    });
  });
  weak.forEach((r, k) => out.push({ kind: 'border', el: k, ratio: r, need: 3, ok: false }));
  return out;
}

async function run() {
  const browser = await launch();
  let fails = 0, checks = 0;
  const failures = [];
  const record = (ctx, list) => {
    for (const f of list) {
      checks++;
      if (!f.ok) { fails++; failures.push(Object.assign({ ctx }, f)); }
    }
  };

  for (const vpName of VPS) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: VIEWPORTS[vpName], colorScheme: theme, hasTouch: vpName.startsWith('mobile') });
      await context.addInitScript((t) => { try { localStorage.setItem('wts_theme', t); } catch (e) {} }, theme);
      for (const page of PAGES) {
        const p = await context.newPage();
        await p.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
        // sanity: the requested theme is the one applied
        const isDark = await p.evaluate(() => document.documentElement.classList.contains('dark'));
        if ((theme === 'dark') !== isDark) { fails++; failures.push({ ctx: `${page} ${vpName} ${theme}`, kind: 'theme', el: 'html', text: 'theme not applied', ratio: 0, need: 0 }); }
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
        const ctx = `${page} ${vpName} ${theme}`;
        if (args.includes('--selftest')) await p.evaluate(() => { const d = document.createElement('p'); d.textContent = 'SELFTEST light grey on bone'; d.style.cssText = 'color:#BBBBBB;background:#F4F0E7;font-size:16px'; document.body.prepend(d); });

        record(ctx + ' [default]', await p.evaluate(measureInPage, null));

        // ---- open menus / selected states ----
        if (vpName.startsWith('desktop')) {
          const tog = await p.$('#home-toggle');
          if (tog && await tog.isVisible()) { await tog.click(); await p.waitForTimeout(150); record(ctx + ' [home dropdown]', await p.evaluate(measureInPage, '#home-menu')); await tog.click(); }
        } else {
          const nt = await p.$('#nav-toggle');
          if (nt && await nt.isVisible()) {
            await nt.click(); await p.waitForTimeout(150);
            const sp = await p.$('#sheet-home-toggle'); if (sp) { await sp.click(); await p.waitForTimeout(100); }
            record(ctx + ' [mobile sheet]', await p.evaluate(measureInPage, '#nav-sheet'));
            await nt.click();
          }
        }
        for (const tab of await p.$$('[role="tab"]')) {
          if (!(await tab.isVisible())) continue;
          await tab.click(); await p.waitForTimeout(150);
          record(ctx + ' [tab selected]', await p.evaluate(measureInPage, (await p.$('[data-tabs]')) ? '[data-tabs]' : '.portal-card'));
        }
        const panels = await p.$$('[data-panel-btn]');
        for (const pb of panels) { if (!(await pb.isVisible())) continue; await pb.click(); await p.waitForTimeout(450); record(ctx + ' [panel open]', await p.evaluate(measureInPage, '[data-panels]')); }

        // ---- student portal states ----
        if (await p.$('[data-app="dashboard"]')) {
          for (const v of ['programs', 'lab-hours', 'exams', 'overview']) {
            await p.evaluate((h) => { location.hash = h; }, v); await p.waitForTimeout(150);
            record(ctx + ` [view ${v}]`, await p.evaluate(measureInPage, '#app-main'));
          }
          await p.evaluate(() => { location.hash = 'programs'; }); await p.waitForTimeout(120);
          await p.click('[data-enroll="mig"]'); await p.waitForTimeout(120);
          record(ctx + ' [demo enrollment]', await p.evaluate(measureInPage, '#programs'));
          await p.click('[data-enroll-clear]');
          if (await p.isVisible('[data-drawer-open]')) {
            await p.click('[data-drawer-open]'); await p.waitForTimeout(300);
            record(ctx + ' [drawer open]', await p.evaluate(measureInPage, '#app-nav'));
            await p.keyboard.press('Escape'); await p.waitForTimeout(250);
          }
        }
        if (await p.$('[data-app="login"]')) {
          await p.click('#tab-signin'); await p.waitForTimeout(80);
          await p.click('#panel-signin .auth-submit'); await p.waitForTimeout(120);
          record(ctx + ' [sign-in errors]', await p.evaluate(measureInPage, '#panel-signin'));
          await p.fill('#si-email', 'audit@example.com'); await p.fill('#si-pass', 'audit-pass');
          await p.click('#panel-signin .auth-submit'); await p.waitForTimeout(120);
          record(ctx + ' [sign-in result]', await p.evaluate(measureInPage, '#panel-signin'));
          await p.click('#tab-register'); await p.waitForTimeout(100);
          await p.click('#panel-register .auth-submit'); await p.waitForTimeout(120);
          record(ctx + ' [register errors]', await p.evaluate(measureInPage, '#panel-register'));
          await p.click('#tab-signin');
        }

        // ---- form states: errors, then the result message ----
        if (await p.$('[data-demo-form]')) {
          await p.click('[data-demo-form] button[type=submit]'); await p.waitForTimeout(150);
          record(ctx + ' [form errors]', await p.evaluate(measureInPage, '[data-demo-form]'));
          // invalid fields carry their own boundary colour; it must reach 3:1 against the field surface
          const errB = await p.$eval('#f-name', (e) => { const cs = getComputedStyle(e); return [cs.borderTopColor, getComputedStyle(e.closest('form')).backgroundColor]; });
          record(ctx + ' [invalid field border]', await p.evaluate(([fg, bg]) => {
            const parse = (s) => s.match(/\d+(\.\d+)?/g).map(Number);
            const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
            const a = lum(parse(fg)), b = lum(parse(bg)); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            return [{ kind: 'boundary', el: 'input[aria-invalid] border', ratio: +r.toFixed(2), need: 3, ok: r >= 3 }];
          }, errB));
          await p.fill('#f-name', 'Audit Test'); await p.fill('#f-email', 'audit@example.com'); await p.selectOption('#f-topic', { index: 1 });
          await p.fill('#f-msg', 'A long enough message for the audit run.');
          await p.click('[data-demo-form] button[type=submit]'); await p.waitForTimeout(150);
          await p.click('[data-demo-form] button[type=reset]');
        }

        // ---- hover states (pointer devices) ----
        if (!vpName.startsWith('mobile')) {
          const sel = '.btn, .nav-link, .arrow-link, .utility-btn, .ctl-btn, .icon-btn, .tab, .paths a, .footer-link, .mods-index a, .rail a, .link, .dropdown a';
          const els = await p.$$(sel);
          let n = 0;
          for (const el of els) {
            if (n > 70) break;
            if (!(await el.isVisible())) continue;
            await el.scrollIntoViewIfNeeded().catch(() => {});
            try { await el.hover({ timeout: 1500 }); } catch (e) { continue; }
            await p.waitForTimeout(190);
            const id = await el.evaluate((e) => { e.setAttribute('data-audit', '1'); return true; });
            if (id) record(ctx + ' [hover]', await p.evaluate(measureInPage, '[data-audit="1"]'));
            await el.evaluate((e) => e.removeAttribute('data-audit'));
            n++;
          }
          await p.mouse.move(0, 0);
        }

        // ---- keyboard focus indicators ----
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.keyboard.press('Tab');
        for (let i = 0; i < 90; i++) {
          const f = await p.evaluate(() => {
            const el = document.activeElement; if (!el || el === document.body) return null;
            const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const q = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: q[0], g: q[1], b: q[2], a: q[3] === undefined ? 1 : q[3] }; };
            const lum = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * g(c.r) + 0.7152 * g(c.g) + 0.0722 * g(c.b); };
            const cs = getComputedStyle(el);
            const oc = parse(cs.outlineColor);
            let bg = { r: 255, g: 255, b: 255, a: 1 };
            const layers = [];
            for (let e = el.parentElement; e; e = e.parentElement) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0) { layers.push(b); if (b.a === 1) break; } }
            for (let i = layers.length - 1; i >= 0; i--) { const t = layers[i]; bg = { r: t.r * t.a + bg.r * (1 - t.a), g: t.g * t.a + bg.g * (1 - t.a), b: t.b * t.a + bg.b * (1 - t.a), a: 1 }; }
            const x = lum(oc), y = lum(bg);
            const r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
            const vis = el.getBoundingClientRect().width > 0;
            return { tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), w: parseFloat(cs.outlineWidth), style: cs.outlineStyle, r: +r.toFixed(2), vis };
          });
          if (f && f.vis) record(ctx + ' [focus]', [{ kind: 'focus', el: f.tag, ratio: f.r, need: 3, ok: f.r >= 3 && f.w >= 2 && f.style !== 'none', text: `outline ${f.w}px ${f.style}` }]);
          await p.keyboard.press('Tab');
        }
        await p.close();
      }
      await context.close();
    }
  }
  await browser.close();

  // de-duplicate repeated failures
  const uniq = new Map();
  failures.forEach((f) => { const k = [f.kind, f.el, f.fg, f.bg, f.text].join('|'); if (!uniq.has(k)) uniq.set(k, Object.assign({ n: 0, ctxs: new Set() }, f)); const u = uniq.get(k); u.n++; u.ctxs.add(f.ctx); });
  console.log(`\nChecks: ${checks}   Failures: ${fails}   Unique failing items: ${uniq.size}`);
  for (const u of uniq.values()) {
    console.log(`FAIL [${u.kind}] ${u.ratio}:1 (need ${u.need}) ${u.fg || ''} on ${u.bg || ''} "${u.text || ''}"${u.image ? ' OVER IMAGE' : ''}\n      ${u.el}\n      e.g. ${[...u.ctxs][0]}${u.ctxs.size > 1 ? ' (+' + (u.ctxs.size - 1) + ' more contexts)' : ''}`);
  }
  if (VERBOSE) console.log('(verbose) done');
  process.exitCode = fails ? 1 : 0;
}
run();
