// Shared Playwright helper: drives the locally installed Chrome (no browser download needed).
const { chromium } = require('playwright-core');
const fs = require('fs');
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];
const BASE = process.env.BASE_URL || 'http://localhost:3000';
async function launch() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  return chromium.launch({ executablePath, headless: true });
}
const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'laptop-1366': { width: 1366, height: 768 },
  'laptop-1280': { width: 1280, height: 720 },
  'tablet-portrait-768': { width: 768, height: 1024 },
  'tablet-landscape-1024': { width: 1024, height: 768 },
  'mobile-390': { width: 390, height: 844 },
  'mobile-small-320': { width: 320, height: 568 },
  'mobile-landscape-844': { width: 844, height: 390 }
};
module.exports = { launch, BASE, VIEWPORTS };
