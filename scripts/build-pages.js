/**
 * Static page builder (no runtime includes, no framework).
 *   src/pages/*.html  +  partials/*.html   ->   ./*.html
 *
 * Tokens in page sources:
 *   <!--@head-->  <!--@sprite-->  <!--@header-->  <!--@footer-->
 *   {{pic key="h1-hero" alt="..." sizes="..." class="..." eager}}   responsive <picture> from assets/images/image-data.json
 *   {{credits}}                                                       image credit list from assets/images/CREDITS.json
 *   {{map}}                                                           OpenStreetMap embed from partials/location.json (only when the location is verified)
 * Header/footer links carrying data-nav="file.html" get aria-current="page" on that page.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'pages');
const PARTIALS = path.join(ROOT, 'partials');
const IMG = path.join(ROOT, 'assets', 'images');

const read = (p) => fs.readFileSync(p, 'utf8');
const partial = (n) => read(path.join(PARTIALS, n + '.html')).trimEnd();
const imageData = fs.existsSync(path.join(IMG, 'image-data.json')) ? JSON.parse(read(path.join(IMG, 'image-data.json'))) : {};
const credits = fs.existsSync(path.join(IMG, 'CREDITS.json')) ? JSON.parse(read(path.join(IMG, 'CREDITS.json'))) : {};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let errors = 0;

function picture(attrs) {
  const key = attrs.key;
  const d = imageData[key];
  if (!d) { console.error('  ! missing image data for', key); errors++; return `<!-- missing image ${key} -->`; }
  if (attrs.alt === undefined) { console.error('  ! missing alt for', key); errors++; }
  const base = `assets/images/${d.dir}/${key}`;
  const srcset = d.widths.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
  const eager = 'eager' in attrs;
  const cls = attrs.class ? ` class="${esc(attrs.class)}"` : '';
  const pos = attrs.pos ? ` style="object-position:${esc(attrs.pos)}"` : '';
  return (
    `<picture><source type="image/webp" srcset="${srcset}" sizes="${esc(attrs.sizes || '100vw')}">` +
    `<img src="${base}.jpg" alt="${esc(attrs.alt || '')}" width="${d.w}" height="${d.h}"${cls}${pos} ` +
    `loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture>`
  );
}

function parseAttrs(s) {
  const out = {};
  const re = /([\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2] === undefined ? true : m[2];
  return out;
}

// General map: a real, pannable OpenStreetMap embed of a default area (partials/location.json -> generalMap).
// It carries no marker and is labelled as a general map, so it never implies where the school is.
const LOCATION_FILE = path.join(PARTIALS, 'location.json');
function mapHtml(cfg) {
  cfg = cfg || (fs.existsSync(LOCATION_FILE) ? JSON.parse(read(LOCATION_FILE)) : {});
  const g = cfg.generalMap;
  if (!g || !Array.isArray(g.bbox) || !Array.isArray(g.center)) { console.error('  ! location.json has no generalMap'); errors++; return ''; }
  const label = esc(g.label);
  const bbox = g.bbox.map((n) => n.toFixed(4)).join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik`;
  const open = `https://www.openstreetmap.org/#map=${g.zoom}/${g.center[0]}/${g.center[1]}`;
  return '<figure class="ct-map" data-map-state="general" data-map>' +
    '<div class="ct-map-stage">' +
    // fallback sits underneath the frame; the script raises it if the provider cannot load
    `<div class="ct-map-fallback" data-map-fallback role="status">` +
    `<p class="ct-map-loading">Loading the map&hellip;</p>` +
    `<div class="ct-map-failed"><p class="ct-map-k">Map unavailable</p>` +
    `<p>The interactive map could not load. You can open the general map of ${label} on OpenStreetMap instead.</p>` +
    `<a class="btn btn-primary btn-sm" href="${open}" target="_blank" rel="noopener">Open the map<span class="sr-only"> of ${label} on OpenStreetMap (opens in a new tab)</span></a></div></div>` +
    `<iframe class="ct-map-frame" data-map-frame title="Interactive general map of ${label}. Not the school&#39;s location." src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` +
    '</div>' +
    `<figcaption class="ct-map-cap"><span class="ct-map-tag">General map: ${label}</span>` +
    '<span class="ct-map-note-inline">Shown for orientation only. It does not mark the school&#39;s location.</span>' +
    `<a class="arrow-link" href="${open}" target="_blank" rel="noopener">Open in OpenStreetMap<span class="sr-only"> (opens in a new tab)</span> <svg class="icon icon-go icon-flip" aria-hidden="true"><use href="#i-arrow"/></svg></a>` +
    '<span class="ct-map-attr">Map data &copy; <a class="link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></span></figcaption></figure>';
}
module.exports = { mapHtml };

function creditsHtml() {
  const byPage = {};
  for (const [key, c] of Object.entries(credits)) (byPage[c.page] = byPage[c.page] || []).push([key, c]);
  const label = { 'index.html': 'Home 1', 'home-2.html': 'Home 2', 'programs.html': 'Programs', 'instructors.html': 'Instructors', 'about.html': 'About', 'contact.html': 'Contact' };
  return Object.entries(byPage).map(([page, list]) =>
    `<section class="credit-group"><h2 class="display d-md">${label[page] || page}</h2><ul class="credit-list">` +
    list.map(([, c]) =>
      `<li><span class="credit-sec">${esc(c.section)}</span> <span><a class="link" href="${esc(c.source)}" rel="noopener">${esc(c.file.replace(/\.jpe?g$/i, ''))}</a>` +
      ` &mdash; ${esc(c.author)}. <a class="link" href="${esc(c.licenseUrl || c.source)}" rel="noopener">${esc(c.license)}</a>. Source: Wikimedia Commons.</span></li>`
    ).join('') + '</ul></section>'
  ).join('\n');
}

function build(file) {
  const page = path.basename(file);
  let html = read(path.join(SRC, file));
  html = html
    .replace('<!--@head-->', partial('head'))
    .replace('<!--@sprite-->', partial('sprite'))
    .replace('<!--@header-->', partial('header'))
    .replace('<!--@footer-->', partial('footer'))
    .replace(/\{\{pic\s+([^}]*)\}\}/g, (_, a) => picture(parseAttrs(a)))
    .replace('{{credits}}', creditsHtml())
    .replace('{{map}}', mapHtml());
  html = html.replace(/<a ([^>]*?)data-nav="([^"]+)"([^>]*)>/g, (m, a, target, b) =>
    target === page ? `<a ${a}data-nav="${target}" aria-current="page"${b}>` : m);
  // disclosure buttons whose group contains this page (e.g. Home -> Home 1 / Home 2) are marked current
  html = html.replace(/<button ([^>]*?)data-nav-group="([^"]+)"([^>]*)>/g, (m, a, group, b) =>
    group.split(/\s+/).includes(page) ? `<button ${a}data-nav-group="${group}" aria-current="true"${b}>` : m);
  fs.writeFileSync(path.join(ROOT, page), html);
  console.log('built', page);
}

if (require.main === module) fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).forEach(build);
if (errors) { console.error(errors + ' error(s)'); process.exitCode = 1; }
