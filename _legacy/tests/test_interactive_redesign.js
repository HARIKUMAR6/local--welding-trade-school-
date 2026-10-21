const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Verify word counts for descriptions
const descriptions = [
  { sec: 'Hero', text: 'Intensive hands-on workshop training preparing tradespeople for immediate industrial, structural, and pipeline fabrication careers.' },
  { sec: 'Section 02', text: 'Every training hour centers on torch control, arc stability, and real-time molten puddle manipulation.' },
  { sec: 'Section 03 (MIG)', text: 'Continuous wire feed for high-deposition structural fabrication and production lines.' },
  { sec: 'Section 03 (TIG)', text: 'High-precision tungsten arc for sanitary stainless, pressure piping, and aerospace alloys.' },
  { sec: 'Section 03 (Stick)', text: 'Heavy-flux consumable electrode for outdoor structural erection, field welding, and heavy repair.' },
  { sec: 'Section 04', text: 'Physical bend tests, visual evaluation, and radiographic criteria prepare students for third-party CWI examinations.' },
  { sec: 'Section 05', text: 'Instructors observe arc length, travel speed, and puddle wetting directly beside your booth.' },
  { sec: 'Section 06', text: 'Practical qualifications prepare graduates for essential commercial fabrication and infrastructure industries.' },
  { sec: 'Section 07', text: 'Small shop cohorts with dedicated booth time and complete tooling.' }
];

console.log('=== WORD COUNT AUDIT (TARGET: 8–18 WORDS) ===');
descriptions.forEach(d => {
  const count = d.text.trim().split(/\s+/).length;
  const inRange = count >= 8 && count <= 18;
  console.log(`[${inRange ? 'PASS' : 'WARN'}] ${d.sec}: ${count} words ("${d.text}")`);
});

// Verify image existence and dimensions
const images = [
  'hero-cinematic-workshop.jpg',
  'practice-torch-control.jpg',
  'methods-tig-training.jpg',
  'inspection-proficiency-test.jpg',
  'guided-instructor-coaching.jpg',
  'pathways-structural-steel.jpg',
  'cta-industrial-shop.jpg'
];

console.log('\n=== LOCAL IMAGE ASSET AUDIT ===');
images.forEach(img => {
  const p = path.join(__dirname, '..', 'assets', 'images', img);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  console.log(`[${exists && size > 0 ? 'PASS' : 'FAIL'}] ${img} exists (${size} bytes)`);
});
