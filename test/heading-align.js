/**
 * Heading-group alignment audit for a page (default programs.html).
 * For every h1/h2 (plus its eyebrow and lead) reports computed text-align and whether the group starts on the
 * section's content start edge. FAIL when a heading group is right-aligned / end-positioned in LTR (or the mirror in RTL),
 * or when the eyebrow, heading and lead of one group do not share a start edge.
 *   node test/heading-align.js [page] [--verbose]
 */
const { launch, BASE, VIEWPORTS } = require('./lib/browser');
const page = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'programs.html';
const verbose = process.argv.includes('--verbose');
let fails = 0, checks = 0;

function inPage() {
  const rtl = document.documentElement.dir === 'rtl';
  const out = [];
  const probe = document.createElement('div'); probe.className = 'wrap'; probe.style.cssText = 'visibility:hidden;height:0'; document.body.appendChild(probe); const pr = probe.getBoundingClientRect(); const pcs = getComputedStyle(probe); const pageEdge = rtl ? pr.right - parseFloat(pcs.paddingRight) : pr.left + parseFloat(pcs.paddingLeft); probe.remove();
  const wrapEdge = () => pageEdge;
  document.querySelectorAll('main h1, main h2').forEach((h) => {
    const r = h.getBoundingClientRect(); if (!r.width) return;
    const sec = h.closest('section') || h.closest('main');
    const group = [h];
    // eyebrow / lead that introduce this heading: siblings or nearest in the same heading container
    const box = h.parentElement;
    const eb = box.querySelector(':scope > .eyebrow') || sec.querySelector('.eyebrow');
    const lead = box.querySelector(':scope > .lead') || sec.querySelector('.lead');
    const edge = wrapEdge(h);
    const plate = h.closest('.pg-band-plate, .lab-panel, .stub');
    // a heading group inside a solid plate is aligned by the plate's edge; the text inside is inset by the plate's own padding
    const ref = plate ? plate.getBoundingClientRect() : null;
    const start = (e) => { const b = e.getBoundingClientRect(); const inner = plate ? (rtl ? ref.right - b.right : b.left - ref.left) : 0; return plate ? (rtl ? edge - ref.right : ref.left - edge) + (inner * 0) : (rtl ? edge - b.right : b.left - edge); }; // distance from the content start edge (0 = on the edge)
    // a centred card (equal gaps either side) is a centred composition: its group is measured inside the card
    const centredCard = !!(plate && plate.matches('.stub') && (() => { const w = (plate.closest('.wrap') || document.body).getBoundingClientRect(); return Math.abs((ref.left - w.left) - (w.right - ref.right)) < 4; })());
    const cs = getComputedStyle(h);
    out.push({
      id: (sec.id || sec.getAttribute('aria-labelledby') || '?') + ' / ' + h.tagName.toLowerCase(),
      text: h.textContent.trim().slice(0, 28),
      textAlign: cs.textAlign,
      headStart: centredCard ? 0 : Math.round(start(h)),
      eyebrowStart: eb && eb.getBoundingClientRect().width ? (centredCard ? 0 : Math.round(start(eb))) : null,
      leadStart: lead && lead.getBoundingClientRect().width ? (centredCard ? 0 : Math.round(start(lead))) : null,
      headWidth: Math.round(r.width),
      // centred groups: every part must be centred and share one axis
      center: (() => { const c = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: Math.round(b.left + b.width / 2), a: getComputedStyle(e).textAlign } : null; }; return { h: c(h), eb: c(eb), lead: c(lead) }; })(),
      content: Math.round((sec.querySelector('.wrap') || sec).getBoundingClientRect().width)
    });
  });
  return out;
}

(async () => {
  const b = await launch();
  for (const vp of ['desktop-1440', 'laptop-1280', 'tablet-portrait-768', 'tablet-landscape-1024', 'mobile-390', 'mobile-small-320', 'mobile-landscape-844']) {
    for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: VIEWPORTS[vp], colorScheme: theme });
      await ctx.addInitScript(([t, d]) => { try { localStorage.setItem('wts_theme', t); localStorage.setItem('wts_dir', d); } catch (e) {} }, [theme, dir]);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
      const rows = await p.evaluate(inPage);
      for (const r of rows) {
        checks++;
        const bad = [];
        if (!['start', 'left', 'right', 'center'].includes(r.textAlign) ) bad.push('odd text-align ' + r.textAlign);
        const physicalEnd = dir === 'ltr' ? 'right' : 'left';
        if (r.textAlign === physicalEnd || r.textAlign === 'end') bad.push('text-align ' + r.textAlign);
        if (r.textAlign === 'center') {
          for (const [k, v] of [['eyebrow', r.center.eb], ['lead', r.center.lead]]) {
            if (!v) continue;
            if (v.a !== 'center') bad.push(`${k} is ${v.a}-aligned inside a centred group`);
            if (Math.abs(v.x - r.center.h.x) > 8) bad.push(`${k} centre (${v.x}) is off the heading centre (${r.center.h.x})`);
          }
        } else {
        if (r.headStart > 8) bad.push(`heading starts ${r.headStart}px in from the content start edge`);
        if (r.eyebrowStart !== null && Math.abs(r.eyebrowStart - r.headStart) > 8) bad.push(`eyebrow (${r.eyebrowStart}) and heading (${r.headStart}) differ`);
        if (r.leadStart !== null && Math.abs(r.leadStart - r.headStart) > 8) bad.push(`lead (${r.leadStart}) and heading (${r.headStart}) differ`);
        }
        if (bad.length) { fails++; console.log(`FAIL ${vp} ${dir}/${theme} [${r.id}] "${r.text}": ${bad.join('; ')}`); }
        else if (verbose) console.log(`ok   ${vp} ${dir}/${theme} [${r.id}] "${r.text}" start=${r.headStart} align=${r.textAlign}`);
      }
      await ctx.close();
    }
  }
  await b.close();
  console.log(`\nHeading alignment: ${checks} heading groups checked, ${fails} problem(s)`);
  process.exitCode = fails ? 1 : 0;
})();
