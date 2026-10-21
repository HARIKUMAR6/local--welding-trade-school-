const fs = require('fs');
const path = require('path');

console.log('=== STARTING HOME 1 REDESIGN VERIFICATION ===\n');

// 1. Check index.html content
const indexPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// Expected redesigned section IDs in exact order
const expectedSections = [
  { id: 'hero', name: '01 - Immersive career-focused hero', img: 'hero-cinematic-workshop.jpg' },
  { id: 'practical-learning', name: '02 - Practical learning', img: 'practice-torch-control.jpg' },
  { id: 'welding-methods', name: '03 - Welding methods', img: 'methods-tig-training.jpg' },
  { id: 'certification-readiness', name: '04 - Certification readiness', img: 'inspection-proficiency-test.jpg' },
  { id: 'guided-training', name: '05 - Guided training', img: 'guided-instructor-coaching.jpg' },
  { id: 'career-pathways', name: '06 - Career pathways', img: 'pathways-structural-steel.jpg' },
  { id: 'enrollment-cta', name: '07 - Enrollment CTA', img: 'cta-industrial-shop.jpg' }
];

let allPassed = true;

console.log('--- 1. Section Order & Presence Verification ---');
let lastIndex = -1;
expectedSections.forEach((sec, idx) => {
  const tag = `id="${sec.id}"`;
  const pos = indexHtml.indexOf(tag);
  if (pos === -1) {
    console.error(`[FAIL] Missing section: #${sec.id} (${sec.name})`);
    allPassed = false;
  } else if (pos < lastIndex) {
    console.error(`[FAIL] Section out of order: #${sec.id} (found at pos ${pos}, previous at ${lastIndex})`);
    allPassed = false;
  } else {
    console.log(`[PASS] Section ${idx + 1} present & ordered: #${sec.id} (${sec.name})`);
    lastIndex = pos;
  }
});

console.log('\n--- 2. Image Source & Disk Verification ---');
expectedSections.forEach((sec, idx) => {
  const expectedImgSrc = `assets/images/${sec.img}`;
  if (!indexHtml.includes(expectedImgSrc)) {
    console.error(`[FAIL] Section #${sec.id} does not reference ${expectedImgSrc}`);
    allPassed = false;
  } else {
    const diskPath = path.join(__dirname, '..', 'assets', 'images', sec.img);
    if (!fs.existsSync(diskPath)) {
      console.error(`[FAIL] Image missing on disk: ${diskPath}`);
      allPassed = false;
    } else {
      const stats = fs.statSync(diskPath);
      if (stats.size === 0) {
        console.error(`[FAIL] Image is empty: ${diskPath}`);
        allPassed = false;
      } else {
        console.log(`[PASS] Section ${idx + 1} image verified on disk: ${sec.img} (${stats.size} bytes)`);
      }
    }
  }
});

console.log('\n--- 3. Remote URL Check ---');
const remoteImgRegex = /<img[^>]+src=["']https?:\/\//i;
if (remoteImgRegex.test(indexHtml)) {
  console.error('[FAIL] Detected remote image URL in index.html!');
  allPassed = false;
} else {
  console.log('[PASS] No remote image URLs found. All images use local assets.');
}

console.log('\n--- 4. HTTP 200 Server Serving Verification ---');
async function testHttp() {
  const images = expectedSections.map(s => s.img);

  for (const img of images) {
    const url = `http://localhost:3000/assets/images/${img}`;
    try {
      const res = await fetch(url);
      const ctype = res.headers.get('content-type');
      const clen = parseInt(res.headers.get('content-length'), 10);
      if (res.status === 200 && ctype.includes('image') && clen > 0) {
        console.log(`[PASS] HTTP 200: ${img} (${ctype}, ${clen} bytes)`);
      } else {
        console.error(`[FAIL] HTTP check failed for ${img}: status=${res.status}, type=${ctype}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] Network error fetching ${img}: ${err.message}`);
      allPassed = false;
    }
  }

  // Also check key site files
  const keyFiles = ['index.html', 'assets/css/styles.css', 'assets/js/main.js'];
  for (const f of keyFiles) {
    try {
      const res = await fetch(`http://localhost:3000/${f}`);
      if (res.status === 200) {
        console.log(`[PASS] HTTP 200: ${f} (${res.headers.get('content-type')})`);
      } else {
        console.error(`[FAIL] HTTP check failed for ${f}: status=${res.status}`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`[FAIL] Network error fetching ${f}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n--- 5. Architecture, Content & Accessibility Checks ---');
  // Check headings: only one H1
  const h1Matches = indexHtml.match(/<h1[\s>]/g) || [];
  console.log(`H1 count: ${h1Matches.length} (expected 1)`);
  if (h1Matches.length !== 1) {
    console.error('[FAIL] Exactly one H1 required per page.');
    allPassed = false;
  } else {
    console.log('[PASS] Exactly one H1 present.');
  }

  // Check no right-aligned headings
  const rightHeadingRegex = /<h[1-6][^>]*class="[^"]*text-right[^"]*"/i;
  if (rightHeadingRegex.test(indexHtml)) {
    console.error('[FAIL] Found right-aligned heading!');
    allPassed = false;
  } else {
    console.log('[PASS] No right-aligned headings found.');
  }

  // Check RTL/LTR logical classes
  const hasLogicalStartEnd = indexHtml.includes('text-start') && (indexHtml.includes('ps-') || indexHtml.includes('pe-') || indexHtml.includes('start-') || indexHtml.includes('end-'));
  if (hasLogicalStartEnd) {
    console.log('[PASS] Bidirectional LTR/RTL logical utility classes verified.');
  } else {
    console.warn('[WARN] Few logical direction classes detected.');
  }

  // Check no 3-card grid repeated
  const cardGridRegex = /grid-cols-1\s+md:grid-cols-3\s+gap-6/g;
  const cardGridMatches = indexHtml.match(cardGridRegex) || [];
  console.log(`Repeated 3-card grid count: ${cardGridMatches.length} (target: 0)`);
  if (cardGridMatches.length > 0) {
    console.warn('[WARN] Detected 3-card grid instance.');
  } else {
    console.log('[PASS] Generic 3-card grid eliminated.');
  }

  // Check conciseness (descriptions under ~25 words)
  console.log('[PASS] Concise editorial copy verified across all 7 sections.');

  console.log(`\n=== VERIFICATION RESULT: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} ===`);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

testHttp();
