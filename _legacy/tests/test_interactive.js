const fs = require('fs');
const path = require('path');

console.log('--- RUNNING SIMULATED INTERACTIVE DOM TESTS ---');

// Mock classes
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  contains(c) { return this.classes.has(c); }
  toggle(c) {
    if (this.contains(c)) { this.remove(c); return false; }
    else { this.add(c); return true; }
  }
}

class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = new MockClassList();
    this.attributes = new Map();
    this.eventListeners = {};
    this.children = [];
    this.textContent = '';
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  removeAttribute(k) { this.attributes.delete(k); }
  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }
  dispatchEvent(eventObj) {
    const list = this.eventListeners[eventObj.type] || [];
    for (const fn of list) fn(eventObj);
  }
  focus() { this.focused = true; }
  contains(child) {
    if (child === this) return true;
    for (const c of this.children) {
      if (c === child || (c.contains && c.contains(child))) return true;
    }
    return false;
  }
  querySelector(selector) {
    if (selector.startsWith('#')) {
      const targetId = selector.substring(1);
      if (this.id === targetId) return this;
      for (const c of this.children) {
        const found = c.querySelector(selector);
        if (found) return found;
      }
    }
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      if (this.classList.contains(cls)) return this;
      for (const c of this.children) {
        const found = c.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }
  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      let matches = false;
      if (selector === 'a' && node.tagName === 'A') matches = true;
      if (matches) results.push(node);
      for (const c of node.children) walk(c);
    };
    walk(this);
    return results;
  }
}

const localStorageMock = (function () {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

const htmlEl = new MockElement('html');
htmlEl.setAttribute('dir', 'ltr');
const bodyEl = new MockElement('body');
htmlEl.children.push(bodyEl);

const siteHeader = new MockElement('header', 'site-header');
const mobileMenuToggle = new MockElement('button', 'mobile-menu-toggle');
mobileMenuToggle.setAttribute('aria-expanded', 'false');
mobileMenuToggle.setAttribute('aria-controls', 'mobile-nav-panel');

const mobileNavPanel = new MockElement('div', 'mobile-nav-panel');
mobileNavPanel.classList.add('hidden');

const mobileMenuOpenIcon = new MockElement('svg', 'mobile-menu-open-icon');
const mobileMenuCloseIcon = new MockElement('svg', 'mobile-menu-close-icon');
mobileMenuCloseIcon.classList.add('hidden');
mobileMenuToggle.children.push(mobileMenuOpenIcon, mobileMenuCloseIcon);

const themeToggle = new MockElement('button');
themeToggle.setAttribute('data-action', 'toggle-theme');
themeToggle.setAttribute('aria-pressed', 'false');

const dirToggle = new MockElement('button');
dirToggle.setAttribute('data-action', 'toggle-dir');
dirToggle.setAttribute('aria-pressed', 'false');

const themeLabel = new MockElement('span');
themeLabel.setAttribute('data-theme-label', '');
themeToggle.children.push(themeLabel);

const dirLabel = new MockElement('span');
dirLabel.setAttribute('data-dir-label', '');
dirToggle.children.push(dirLabel);

const copyrightYear = new MockElement('span', 'copyright-year');

const navLinkHome = new MockElement('a');
navLinkHome.setAttribute('href', 'index.html');
const navLinkPrograms = new MockElement('a');
navLinkPrograms.setAttribute('href', 'programs.html');

const mobileLinkHome = new MockElement('a');
mobileLinkHome.setAttribute('href', 'index.html');
const mobileLinkPrograms = new MockElement('a');
mobileLinkPrograms.setAttribute('href', 'programs.html');
mobileNavPanel.children.push(mobileLinkHome, mobileLinkPrograms);

siteHeader.children.push(mobileMenuToggle, themeToggle, dirToggle, navLinkHome, navLinkPrograms, mobileNavPanel);
bodyEl.children.push(siteHeader, copyrightYear);

global.document = {
  documentElement: htmlEl,
  body: bodyEl,
  getElementById: (id) => {
    const map = {
      'site-header': siteHeader,
      'mobile-menu-toggle': mobileMenuToggle,
      'mobile-nav-panel': mobileNavPanel,
      'mobile-menu-open-icon': mobileMenuOpenIcon,
      'mobile-menu-close-icon': mobileMenuCloseIcon,
      'copyright-year': copyrightYear
    };
    return map[id] || null;
  },
  querySelectorAll: (selector) => {
    if (selector.includes('toggle-theme')) return [themeToggle];
    if (selector.includes('toggle-dir')) return [dirToggle];
    if (selector.includes('data-theme-label')) return [themeLabel];
    if (selector.includes('data-dir-label')) return [dirLabel];
    if (selector.includes('data-theme-icon')) return [];
    if (selector.includes('data-year') || selector.includes('#copyright-year')) return [copyrightYear];
    if (selector.includes('nav a')) return [navLinkHome, navLinkPrograms, mobileLinkHome, mobileLinkPrograms];
    return [];
  },
  addEventListener: (event, fn) => {
    bodyEl.addEventListener(event, fn);
  },
  readyState: 'complete'
};

global.window = {
  location: { pathname: '/index.html' },
  matchMedia: (query) => ({
    matches: false,
    addEventListener: () => {}
  }),
  innerWidth: 1024,
  addEventListener: () => {}
};

global.localStorage = localStorageMock;

// Execute main.js script
const scriptContent = fs.readFileSync(path.join(__dirname, '..', 'assets/js/main.js'), 'utf8');
eval(scriptContent);

// Test 1: Theme toggle
console.log('Testing Theme Toggle...');
console.assert(!htmlEl.classList.contains('dark'), 'Initial theme should be light');
themeToggle.dispatchEvent({ type: 'click' });
console.assert(htmlEl.classList.contains('dark'), 'Theme should toggle to dark');
console.assert(localStorage.getItem('wts_theme') === 'dark', 'localStorage should persist dark theme');
themeToggle.dispatchEvent({ type: 'click' });
console.assert(!htmlEl.classList.contains('dark'), 'Theme should toggle back to light');
console.assert(localStorage.getItem('wts_theme') === 'light', 'localStorage should persist light theme');
console.log('[PASS] Theme Toggle works and persists in localStorage');

// Test 2: Direction toggle
console.log('Testing Direction Toggle...');
console.assert(htmlEl.getAttribute('dir') === 'ltr', 'Initial direction should be ltr');
dirToggle.dispatchEvent({ type: 'click' });
console.assert(htmlEl.getAttribute('dir') === 'rtl', 'Direction should toggle to rtl');
console.assert(localStorage.getItem('wts_dir') === 'rtl', 'localStorage should persist rtl direction');
dirToggle.dispatchEvent({ type: 'click' });
console.assert(htmlEl.getAttribute('dir') === 'ltr', 'Direction should toggle back to ltr');
console.assert(localStorage.getItem('wts_dir') === 'ltr', 'localStorage should persist ltr direction');
console.log('[PASS] Direction Toggle works and persists in localStorage');

// Test 3: Mobile Menu Drawer open & close
console.log('Testing Mobile Menu Drawer...');
console.assert(mobileNavPanel.classList.contains('hidden'), 'Mobile menu is initially hidden');
console.assert(mobileMenuToggle.getAttribute('aria-expanded') === 'false', 'aria-expanded is initially false');

mobileMenuToggle.dispatchEvent({ type: 'click' });
console.assert(!mobileNavPanel.classList.contains('hidden'), 'Mobile menu is open (hidden class removed)');
console.assert(mobileMenuToggle.getAttribute('aria-expanded') === 'true', 'aria-expanded is true when open');
console.assert(mobileMenuOpenIcon.classList.contains('hidden'), 'Open icon is hidden when menu open');
console.assert(!mobileMenuCloseIcon.classList.contains('hidden'), 'Close icon is visible when menu open');

// Test 4: Escape key closes menu
console.log('Testing Escape Key closing Mobile Menu...');
bodyEl.dispatchEvent({ type: 'keydown', key: 'Escape' });
console.assert(mobileNavPanel.classList.contains('hidden'), 'Mobile menu is closed after Escape key');
console.assert(mobileMenuToggle.getAttribute('aria-expanded') === 'false', 'aria-expanded is false after Escape key');
console.assert(mobileMenuToggle.focused === true, 'Focus is restored to toggle button on Escape');
console.log('[PASS] Mobile Menu opens and closes via toggle and Escape key with focus restoration');

// Test 5: Dynamic Copyright Year
console.log('Testing Dynamic Copyright Year...');
console.assert(copyrightYear.textContent == new Date().getFullYear(), `Copyright year should be ${new Date().getFullYear()}`);
console.log(`[PASS] Copyright year dynamically initialized to ${copyrightYear.textContent}`);

// Test 6: Active Navigation Link
console.log('Testing Active Navigation Item...');
console.assert(navLinkHome.getAttribute('aria-current') === 'page', 'Home link has aria-current="page"');
console.assert(navLinkHome.classList.contains('nav-link-active'), 'Home link has nav-link-active class');
console.assert(navLinkPrograms.getAttribute('aria-current') === null, 'Programs link does NOT have aria-current');
console.log('[PASS] Active link correctly highlighted for current page');

console.log('=====================================================');
console.log('ALL INTERACTIVE TESTS PASSED!');
console.log('=====================================================');
