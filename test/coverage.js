/**
 * Content coverage + structural difference check for the two homepages.
 *  1. Every required core-business item appears on BOTH homepages (checked against visible text).
 *  2. Home 1 and Home 2 use different section structures: compares the component vocabulary of each page.
 *  3. No leftover placeholder / unverified-claim text.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();
const pages = { 'index.html': text('index.html'), 'home-2.html': text('home-2.html') };

const items = [
  ['1 School identity & purpose', [/welding trade school/, /(trade school|welding school)/]],
  ['2 Certification & value of training', [/certification/, /(credential|proves what they can do|documented test)/]],
  ['3 Programs / welding types (MIG, TIG, Stick)', [/mig/, /tig/, /stick/]],
  ['4 Practical lab / hands-on workshop', [/lab/, /(hands-on|at the booth|at the bench)/]],
  ['5 Instructor expertise & support', [/instructors/, /(demonstrate|stand beside)/]],
  ['6 Certification preparation & assessment', [/prepar/, /assess/]],
  ['7 Career readiness & pathways (no guarantees)', [/(careers|where .* (skills|welding))/, /no placement is guaranteed/]],
  ['8 Outcomes / what you leave with (verified-only content)', [/(walk away with|your record)/, /exam results/]],
  ['9 Enrollment / exploration CTAs', [/enroll now/, /explore programs/]],
  ['10 Contact info & navigation', [/contact admissions|admissions/, /student login/]]
];
let fails = 0;
console.log('CORE INFORMATION COVERAGE');
for (const [name, res] of items) {
  const row = Object.entries(pages).map(([f, t]) => (res.every((r) => r.test(t)) ? 'yes' : (fails++, 'MISSING')));
  console.log(`  ${name.padEnd(58)} Home 1: ${row[0].padEnd(8)} Home 2: ${row[1]}`);
}

// structural difference: the CSS component classes that appear in each page's <main>
const vocab = (f) => {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const generic = new Set(['wrap', 'section', 'display', 'lead', 'eyebrow', 'btn', 'btn-primary', 'btn-secondary', 'arrow-link', 'photo', 'plate', 'cap', 'bead', 'icon', 'icon-go', 'icon-flip', 'body-2', 'spec', 'spec-h', 'grid', 'flex', 'glyph', 'link', 'plate-steel', 'plate-flip', 'plate-ink']);
  const set = new Set();
  for (const m of main.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (/^[a-z][a-z0-9-]*$/.test(c) && !generic.has(c) && !/^(d-|lg:|md:|sm:|mt-|mb-|gap-|text-|items-|justify-|order-|col-|grid-|self-|pt-|pb-|max-|min-|w-|h-|nav:|tone-)/.test(c)) set.add(c);
  const sections = [...main.matchAll(/<section[^>]*>/g)].length;
  const tones = [...main.matchAll(/tone-(paper|alt|ink|arc)/g)].map((m) => m[1]).join('>');
  return { set, sections, tones };
};
const a = vocab('index.html'), b = vocab('home-2.html');
const shared = [...a.set].filter((c) => b.set.has(c));
const jaccard = shared.length / new Set([...a.set, ...b.set]).size;
console.log(`\nSTRUCTURE\n  Home 1: ${a.sections} sections, tones ${a.tones}\n  Home 2: ${b.sections} sections, tones ${b.tones}`);
console.log(`  distinct component classes: Home 1 ${a.set.size}, Home 2 ${b.set.size}, shared ${shared.length} (${shared.join(', ') || 'none'}), overlap ${(jaccard * 100).toFixed(0)}%`);
if (jaccard > 0.15) { fails++; console.log('FAIL homepages share too many section components'); }
if (a.tones === b.tones) { fails++; console.log('FAIL identical tone rhythm'); }

// placeholder / unverified claims
const banned = [/lorem|ipsum|todo|tbd|coming soon|placeholder|\[add /, /est\. 1994|accredited|12-trainee|day (&|and) evening|full ppe issued|booth time ratio|85%|aws d1\.1|asme|cwi|osha/];
for (const [f, t] of Object.entries(pages)) for (const re of banned) if (re.test(t)) { fails++; console.log(`FAIL ${f}: contains banned/unverified text ${re}`); }
const raw = ['index.html', 'home-2.html'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));
raw.forEach((h, i) => { if (/<img[^>]+src=""/.test(h) || /href="#"/.test(h)) { fails++; console.log(`FAIL page ${i}: empty src or dead # link`); } });

console.log(`\nCoverage check: ${fails ? fails + ' problem(s)' : 'all clear'}`);
process.exitCode = fails ? 1 : 0;
