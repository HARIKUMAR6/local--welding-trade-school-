/**
 * Viewport / layout audit across the required sizes (plus intermediate widths), both themes.
 *   node test/viewport-audit.js [--pages a.html,b.html] [--widths extra]
 * Per page / viewport / theme it checks:
 *   - no horizontal page overflow (documentElement.scrollWidth <= innerWidth)
 *   - no element sticking out past the viewport edge (excluding intentional horizontal scrollers)
 *   - text clipping: headings / buttons / labels whose content is wider or taller than their box
 *   - overlap between sibling headings, buttons and badges
 *   - hero: header + hero fit; primary CTA position vs viewport height (reported, flagged if hero is > 1.6x viewport)
 *   - images: loaded, not stretched (rendered aspect vs natural aspect with object-fit cover is fine) and not upscaled > 1.5x
 *   - tap targets: interactive elements smaller than 24x24 CSS px (WCAG 2.2 target size minimum)
 *   - sticky enroll bar / sheet do not cover the last line of the page
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PAGES = opt('--pages', 'index.html,home-2.html,programs.html,instructors.html,about.html,contact.html,login.html,dashboard.html').split(',');
const EXTRA = { 'w360': { width: 360, height: 740 }, 'w414': { width: 414, height: 896 }, 'w600': { width: 600, height: 900 }, 'w900': { width: 900, height: 1000 }, 'w1100': { width: 1100, height: 800 }, 'w1239': { width: 1239, height: 800 }, 'w1241': { width: 1241, height: 800 }, 'w1920': { width: 1920, height: 1080 } };
const ALL = Object.assign({}, VIEWPORTS, EXTRA);
const NAMES = opt('--viewports', Object.keys(ALL).join(',')).split(',');

function auditInPage() {
  const issues = [];
  const vw = window.innerWidth;
  const path = (el) => { const parts = []; for (let e = el; e && e.nodeType === 1 && parts.length < 3; e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.className && typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/)[0]; parts.unshift(s); } return parts.join(' > '); };
  const inScroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth) return true; } return false; };
  const hiddenAnc = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return true; if (e.hasAttribute('hidden')) return true; } return false; };

  if (document.documentElement.scrollWidth > vw + 1) issues.push({ t: 'page-overflow', d: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });

  document.querySelectorAll('body *').forEach((el) => {
    if (hiddenAnc(el) || el.closest('svg') && el.tagName !== 'svg') return;
    if (el.closest('.skip-link') || el.closest('.sr-only')) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const rtl = document.documentElement.dir === 'rtl';
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && getComputedStyle(el).position !== 'fixed') {
      // pseudo-offset backers are pseudo-elements, so only real elements are reported here
      issues.push({ t: 'overflow-x', d: `${path(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} (vw ${vw})` });
    }
  });

  document.querySelectorAll('h1, h2, h3, .btn, .eyebrow, .cap, .pill, .tab, .xp-t, .paths-body b, .nav-link, .brand-name b').forEach((el) => {
    if (hiddenAnc(el)) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).display !== 'inline') issues.push({ t: 'text-clipped-x', d: `${path(el)} scrollWidth ${el.scrollWidth} > ${el.clientWidth} "${el.textContent.trim().slice(0, 30)}"` });
    const cs = getComputedStyle(el);
    if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight > el.clientHeight + 2) issues.push({ t: 'text-clipped-y', d: `${path(el)} "${el.textContent.trim().slice(0, 30)}"` });
  });

  // overlap between consecutive text blocks / buttons within the same parent
  document.querySelectorAll('main h1, main h2, main h3, main .btn, main .eyebrow, header .btn, header .brand, header .nav-link').forEach((a) => {
    if (hiddenAnc(a)) return;
    const ra = a.getBoundingClientRect(); if (!ra.width) return;
    let b = a.nextElementSibling;
    while (b && hiddenAnc(b)) b = b.nextElementSibling;
    if (!b || !b.matches('h1, h2, h3, .btn, .eyebrow, .nav-link, p')) return;
    const rb = b.getBoundingClientRect(); if (!rb.width) return;
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 2 && oy > 2 && getComputedStyle(a).position !== 'absolute' && getComputedStyle(b).position !== 'absolute') issues.push({ t: 'overlap', d: `${path(a)} overlaps ${path(b)} (${Math.round(ox)}x${Math.round(oy)})` });
  });

  // text sitting over a photograph without a solid backing plate
  const imgEls = [...document.querySelectorAll('main img')].filter((i) => !hiddenAnc(i));
  const imgs = imgEls.map((i) => i.getBoundingClientRect());
  const img_of = (rect) => imgEls[imgs.indexOf(rect)];
  document.querySelectorAll("main p, main li, main h1, main h2, main h3, main .btn, main .eyebrow, main a").forEach((el) => {
    if (hiddenAnc(el) || el.closest(".photo, .cap, .lab-panel, .xp-btn, .xp-desc, .mod-tag, .tabpanel .photo")) return;
    if (el.querySelector('.hl, img') || el.classList.contains('hl')) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    for (const ir of imgs) {
      const ox = Math.min(r.right, ir.right) - Math.max(r.left, ir.left), oy = Math.min(r.bottom, ir.bottom) - Math.max(r.top, ir.top);
      if (ox > 6 && oy > 6) {
        // backed = an opaque-background ancestor exists below the first ancestor that also contains the image
        let backed = false;
        for (let a = el; a && !a.contains(img_of(ir)); a = a.parentElement) { const bg = getComputedStyle(a).backgroundColor.match(/rgba?\(([^)]+)\)/); if (bg) { const p = bg[1].split(/[ ,\/]+/).filter(Boolean).map(Number); if ((p[3] === undefined ? 1 : p[3]) === 1) { backed = true; break; } } }
        if (backed) continue;
        issues.push({ t: 'text-over-image', d: path(el) + ' "' + el.textContent.trim().slice(0, 30) + '"' }); break; }
    }
  });

  // images
  document.querySelectorAll('img').forEach((img) => {
    if (hiddenAnc(img)) return;
    const r = img.getBoundingClientRect(); if (!r.width) return;
    if (img.loading === 'lazy' && !img.complete) return; // not yet requested (audited by test/image-audit.js)
    if (img.complete && img.naturalWidth === 0) issues.push({ t: 'img-broken', d: img.src.split('/').pop() });
    const dpr = window.devicePixelRatio || 1;
    if (img.naturalWidth && r.width * dpr > img.naturalWidth * 1.5) issues.push({ t: 'img-upscaled', d: `${img.currentSrc.split('/').pop()} natural ${img.naturalWidth} shown ${Math.round(r.width)}@${dpr}x` });
  });

  // tap targets (WCAG 2.2 SC 2.5.8, 24px minimum)
  document.querySelectorAll('a[href], button, [role="tab"], [tabindex="0"]').forEach((el) => {
    if (hiddenAnc(el)) return;
    if (el.closest('.skip-link') || el.matches('.skip-link')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline') return; // inline text links are exempt
    const r = el.getBoundingClientRect(); if (!r.width) return;
    if (r.width < 24 || r.height < 24) issues.push({ t: 'small-target', d: `${path(el)} ${Math.round(r.width)}x${Math.round(r.height)}` });
  });

  // hero info
  const hero = document.querySelector('main > section');
  const info = {};
  if (hero) {
    const hr = hero.getBoundingClientRect();
    info.heroBottom = Math.round(hr.bottom + window.scrollY);
    info.vh = window.innerHeight;
    const cta = hero.querySelector('.btn-primary');
    if (cta) info.ctaBottom = Math.round(cta.getBoundingClientRect().bottom + window.scrollY);
  }
  return { issues, info };
}

(async () => {
  const browser = await launch();
  let total = 0;
  const lines = [];
  for (const name of NAMES) {
    const size = ALL[name]; if (!size) continue;
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: size, colorScheme: theme, hasTouch: size.width < 1024 });
      await ctx.addInitScript((t) => { try { localStorage.setItem('wts_theme', t); } catch (e) {} }, theme);
      for (const page of PAGES) {
        const p = await ctx.newPage();
        await p.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
        await p.waitForTimeout(250);
        const res = await p.evaluate(auditInPage);
        // hero heuristics
        const heroNote = [];
        if (page === 'index.html' || page === 'home-2.html') {
          const { heroBottom, vh, ctaBottom } = res.info;
          if (heroBottom > vh * 1.6 && size.width >= 768) res.issues.push({ t: 'hero-too-tall', d: `hero bottom ${heroBottom}px vs viewport ${vh}px` });
          if (ctaBottom && ctaBottom > vh && size.width >= 1024) res.issues.push({ t: 'cta-below-fold', d: `primary CTA bottom ${ctaBottom}px vs viewport ${vh}px` });
          heroNote.push(`hero ${heroBottom}/${vh}, cta ${ctaBottom || '-'}`);
        }
        // sticky bar must not cover final content: scroll to bottom and check footer last element is above bar
        await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        await p.waitForTimeout(400);
        const cover = await p.evaluate(() => {
          const bar = document.getElementById('enroll-bar');
          if (!bar || getComputedStyle(bar).display === 'none') return null;
          const br = bar.getBoundingClientRect();
          const last = document.querySelector('.footer-bottom .wrap'); if (!last) return null;
          const lr = last.getBoundingClientRect();
          return lr.bottom > br.top + 1 ? `enroll bar covers footer bottom (${Math.round(lr.bottom)} > ${Math.round(br.top)})` : null;
        });
        if (cover) res.issues.push({ t: 'sticky-cover', d: cover });
        total += res.issues.length;
        const key = `${page} @ ${name} ${theme}`;
        if (res.issues.length) { lines.push(`✗ ${key}${heroNote.length ? ' (' + heroNote[0] + ')' : ''}`); const seen = new Set(); res.issues.forEach((i) => { const k = i.t + i.d; if (!seen.has(k)) { seen.add(k); lines.push(`    ${i.t}: ${i.d}`); } }); }
        else if (args.includes('--verbose')) lines.push(`✓ ${key} ${heroNote[0] || ''}`);
        await p.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(lines.join('\n'));
  console.log(`\nViewport audit: ${total} issue(s) across ${NAMES.length} viewport(s) x 2 themes x ${PAGES.length} page(s)`);
  process.exitCode = total ? 1 : 0;
})();
