const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function check() {
  console.log('=== RUNNING HOME 2 REDESIGN VERIFICATION ===\n');
  let errors = 0;

  // 1. Check home-2.html file exists
  const home2Path = path.join(rootDir, 'home-2.html');
  if (!fs.existsSync(home2Path)) {
    console.error('FAIL: home-2.html does not exist');
    errors++;
    return;
  }
  const home2Html = fs.readFileSync(home2Path, 'utf8');
  console.log('PASS: home-2.html exists (' + home2Html.length + ' bytes)');

  // 2. Check exactly 7 sections in home-2.html
  const expectedSections = [
    { id: 'workshop-statement', name: 'Section 01 — Workshop Statement' },
    { id: 'welding-methods', name: 'Section 02 — Welding Methods' },
    { id: 'practice-action', name: 'Section 03 — Practice in Action' },
    { id: 'skills-standards', name: 'Section 04 — Skills That Matter' },
    { id: 'guided-training', name: 'Section 05 — Guided Training' },
    { id: 'skills-industry', name: 'Section 06 — Skills in Industry' },
    { id: 'explore-path', name: 'Section 07 — Explore Your Path' }
  ];

  console.log('\n--- Checking 7 Home 2 Sections ---');
  expectedSections.forEach((sec, idx) => {
    const hasSec = home2Html.includes(`id="${sec.id}"`);
    if (hasSec) {
      console.log(`PASS: Section 0${idx + 1} found: #${sec.id} (${sec.name})`);
    } else {
      console.error(`FAIL: Missing section: #${sec.id} (${sec.name})`);
      errors++;
    }
  });

  // Count total <section tags
  const sectionCount = (home2Html.match(/<section/g) || []).length;
  if (sectionCount === 7) {
    console.log(`PASS: Exactly 7 <section> elements in home-2.html`);
  } else {
    console.error(`FAIL: Found ${sectionCount} <section> elements, expected exactly 7`);
    errors++;
  }

  // 3. Check single <h1> tag
  const h1Matches = home2Html.match(/<h1[\s\S]*?<\/h1>/g) || [];
  if (h1Matches.length === 1) {
    console.log(`PASS: Exactly one <h1> element on page: ${h1Matches[0].replace(/\s+/g, ' ').substring(0, 80)}...`);
  } else {
    console.error(`FAIL: Expected 1 <h1>, found ${h1Matches.length}`);
    errors++;
  }

  // 4. Check for right-aligned section headings (prohibited)
  const rightAlignedHeadings = (home2Html.match(/<h[1-6][^>]*class="[^"]*(text-right|text-end)[^"]*"/g) || []);
  if (rightAlignedHeadings.length === 0) {
    console.log(`PASS: Zero right-aligned section headings found (all headings use default left alignment or intentional center alignment)`);
  } else {
    console.error(`FAIL: Found right-aligned headings: ${rightAlignedHeadings.length}`);
    errors++;
  }

  // 5. Check dedicated images
  console.log('\n--- Checking Dedicated Home 2 Images ---');
  const expectedImages = [
    'home2-workbench-welder.jpg',
    'home2-welding-programs.jpg',
    'home2-training-workflow.jpg',
    'home2-skills-inspection.jpg',
    'home2-guided-instruction.jpg',
    'home2-career-pathways.jpg'
  ];

  const home1Html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  expectedImages.forEach((imgName) => {
    const imgPath = path.join(rootDir, 'assets', 'images', imgName);
    if (!fs.existsSync(imgPath)) {
      console.error(`FAIL: Image missing on disk: ${imgName}`);
      errors++;
      return;
    }
    const stat = fs.statSync(imgPath);
    if (stat.size === 0) {
      console.error(`FAIL: Image is empty (0 bytes): ${imgName}`);
      errors++;
      return;
    }

    if (!home2Html.includes(imgName)) {
      console.error(`FAIL: Image not referenced in home-2.html: ${imgName}`);
      errors++;
      return;
    }

    if (home1Html.includes(imgName)) {
      console.error(`FAIL: Image is reused from Home 1: ${imgName}`);
      errors++;
      return;
    }

    console.log(`PASS: ${imgName} (${stat.size.toLocaleString()} bytes) verified & unique`);
  });

  // 6. Check Home Dropdown in both index.html and home-2.html
  console.log('\n--- Checking Shared Home Dropdown ---');
  ['index.html', 'home-2.html'].forEach((filename) => {
    const content = fs.readFileSync(path.join(rootDir, filename), 'utf8');
    
    const hasDesktopTrigger = content.includes('id="home-dropdown-trigger"');
    const hasDesktopMenu = content.includes('id="home-dropdown-menu"');
    const hasDesktopHome1 = content.includes('href="index.html"') && content.includes('Home 1');
    const hasDesktopHome2 = content.includes('href="home-2.html"') && content.includes('Home 2');
    
    const hasMobileTrigger = content.includes('id="mobile-home-dropdown-trigger"');
    const hasMobileSubmenu = content.includes('id="mobile-home-submenu"');

    if (hasDesktopTrigger && hasDesktopMenu && hasDesktopHome1 && hasDesktopHome2 && hasMobileTrigger && hasMobileSubmenu) {
      console.log(`PASS: ${filename} contains full desktop and mobile Home dropdown markup`);
    } else {
      console.error(`FAIL: ${filename} missing part of Home dropdown markup`);
      errors++;
    }

    const menuHidden = content.includes('id="home-dropdown-menu"') && /id="home-dropdown-menu"[^>]*class="[^"]*hidden/.test(content);
    const mobileSubHidden = content.includes('id="mobile-home-submenu"') && /id="mobile-home-submenu"[^>]*class="[^"]*hidden/.test(content);
    if (menuHidden && mobileSubHidden) {
      console.log(`PASS: ${filename} dropdowns are hidden by default`);
    } else {
      console.error(`FAIL: ${filename} dropdowns not hidden by default`);
      errors++;
    }
  });

  console.log(`\n=== VERIFICATION COMPLETE: ${errors === 0 ? 'ALL CHECKS PASSED (0 ERRORS)' : errors + ' ERRORS FOUND'} ===`);
  process.exit(errors === 0 ? 0 : 1);
}

check();
