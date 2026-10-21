const fs = require('fs');
const path = require('path');

console.log('=====================================================');
console.log('HEADER CORRECTION VALIDATION & ASSERTION SUITE');
console.log('=====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const htmlFiles = [
  'index.html',
  'programs.html',
  'instructors.html',
  'about.html',
  'contact.html',
  'login.html'
];

// 1. Files existence check
for (const file of htmlFiles) {
  assert(fs.existsSync(path.join(__dirname, '..', file)), `File exists: ${file}`);
}

// 2. Strict check for absence of unwanted navigation numbers
for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert(!content.includes('[01]'), `${file}: No '[01]' prefix found`);
  assert(!content.includes('[02]'), `${file}: No '[02]' prefix found`);
  assert(!content.includes('[03]'), `${file}: No '[03]' prefix found`);
  assert(!content.includes('[04]'), `${file}: No '[04]' prefix found`);
  assert(!content.includes('[05]'), `${file}: No '[05]' prefix found`);
  assert(!content.includes('nav-num'), `${file}: No 'nav-num' CSS class present`);
  assert(!content.includes('FACILITY ACTIVE // CODE: WTS-01'), `${file}: Unnecessary top utility bar removed`);
}

// 3. Brand Wordmark Typography Checks
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(indexHtml.includes('brand-lockup-dominant'), 'Brand has dominant line class');
assert(indexHtml.includes('brand-lockup-sub'), 'Brand has sub-line class');
assert(indexHtml.includes('WELDING'), 'Brand contains dominant line "WELDING"');
assert(indexHtml.includes('TRADE SCHOOL'), 'Brand contains sub-line "TRADE SCHOOL"');

// 4. Header Navigation & Links Checks
assert(indexHtml.includes('>Home<'), 'Nav item displays "Home" without numbers');
assert(indexHtml.includes('>Programs<'), 'Nav item displays "Programs" without numbers');
assert(indexHtml.includes('>Instructors<'), 'Nav item displays "Instructors" without numbers');
assert(indexHtml.includes('>About<'), 'Nav item displays "About" without numbers');
assert(indexHtml.includes('>Contact<'), 'Nav item displays "Contact" without numbers');

// 5. Button System Checks
assert(indexHtml.includes('btn-primary-login'), 'Solid Student Login button class present');
assert(indexHtml.includes('Student Login'), 'Primary button displays "Student Login"');
assert(indexHtml.includes('btn-icon-control'), 'Compact icon control class used for theme/dir');
assert(indexHtml.includes('aria-label="Switch theme"'), 'Accessible label "Switch theme" present');
assert(indexHtml.includes('aria-label="Switch text direction"'), 'Accessible label "Switch text direction" present');

// 6. CSS Styling Checks
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/styles.css'), 'utf8');
assert(css.includes('#D5A84A') || css.includes('#d5a84a'), 'CSS contains Safety Gold (#D5A84A)');
assert(css.includes('#222A30') || css.includes('#222a30'), 'CSS contains Graphite (#222A30)');
assert(!css.includes('nav-num'), 'CSS has no leftover nav-num styling');

// 7. JavaScript Functional Integrity
const js = fs.readFileSync(path.join(__dirname, '..', 'assets/js/main.js'), 'utf8');
assert(js.includes('wts_theme'), 'JS persists theme preference');
assert(js.includes('wts_dir'), 'JS persists direction preference');
assert(js.includes('Escape'), 'JS handles Escape key to close mobile menu');
assert(js.includes('aria-current'), 'JS assigns aria-current="page" to active link');
assert(js.includes('new Date().getFullYear()'), 'JS generates dynamic copyright year');

console.log('=====================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED!`);
console.log('=====================================================');
