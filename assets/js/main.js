/**
 * Welding Trade School — site behaviour
 * Shared shell (theme, direction, navigation, enroll bar) + homepage interactions (tabs, scrollers, expanding panels).
 * Storage keys are unchanged from the previous build: wts_theme, wts_dir.
 */
(function () {
  'use strict';

  var THEME_KEY = 'wts_theme';
  var DIR_KEY = 'wts_dir';
  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- Theme ---------- */
  function currentTheme() { return root.classList.contains('dark') ? 'dark' : 'light'; }
  function applyTheme(theme) {
    var dark = theme === 'dark';
    root.classList.toggle('dark', dark);
    $$('[data-action="toggle-theme"]').forEach(function (btn) {
      if (btn.hasAttribute('data-icon-only')) {
        // icon-only control: the label always names the action, so no aria-pressed
        var act = dark ? 'Switch to light mode' : 'Switch to dark mode';
        btn.setAttribute('aria-label', act);
        btn.removeAttribute('title');
      } else {
        btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        btn.setAttribute('aria-label', dark ? 'Theme: dark. Switch to light mode' : 'Theme: light. Switch to dark mode');
      }
      var sun = $('.icon-sun', btn), moon = $('.icon-moon', btn);
      if (sun && moon) { sun.style.display = dark ? '' : 'none'; moon.style.display = dark ? 'none' : ''; }
    });
    $$('[data-theme-label]').forEach(function (el) { el.textContent = dark ? 'DARK' : 'LIGHT'; });
    $$('[data-set-theme]').forEach(function (btn) { btn.setAttribute('aria-pressed', btn.getAttribute('data-set-theme') === theme ? 'true' : 'false'); });
  }
  $$('[data-set-theme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.getAttribute('data-set-theme');
      store.set(THEME_KEY, t);
      applyTheme(t);
    });
  });
  $$('[data-action="toggle-theme"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      store.set(THEME_KEY, next);
      applyTheme(next);
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function (e) { if (!store.get(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light'); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme);
  }

  /* ---------- Direction ---------- */
  function applyDir(dir) {
    var rtl = dir === 'rtl';
    root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    $$('[data-action="toggle-dir"]').forEach(function (btn) {
      var lbl = rtl ? 'Text direction: right to left. Switch to left to right' : 'Text direction: left to right. Switch to right to left';
      if (!btn.hasAttribute('data-icon-only')) btn.setAttribute('aria-pressed', rtl ? 'true' : 'false');
      btn.setAttribute('aria-label', lbl);
      btn.removeAttribute('title');
    });
    $$('[data-dir-label]').forEach(function (el) { el.textContent = rtl ? 'RTL' : 'LTR'; });
  }
  $$('[data-action="toggle-dir"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('dir') === 'rtl' ? 'ltr' : 'rtl';
      store.set(DIR_KEY, next);
      applyDir(next);
    });
  });

  /* ---------- Home anchors (Certification / Careers resolve in-page on a homepage) ---------- */
  $$('[data-home-anchor]').forEach(function (a) {
    if (document.getElementById(a.getAttribute('data-home-anchor'))) a.setAttribute('href', '#' + a.getAttribute('data-home-anchor'));
  });

  /* ---------- Home dropdown (desktop disclosure) ---------- */
  var homeToggle = $('#home-toggle');
  var homeMenu = $('#home-menu');
  function setHome(open, returnFocus) {
    if (!homeToggle || !homeMenu) return;
    homeMenu.hidden = !open;
    homeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open && returnFocus) homeToggle.focus();
  }
  if (homeToggle && homeMenu) {
    homeToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setHome(homeToggle.getAttribute('aria-expanded') !== 'true');
    });
    homeToggle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHome(true); var a = $('a', homeMenu); if (a) a.focus(); }
    });
    homeMenu.addEventListener('keydown', function (e) {
      var links = $$('a', homeMenu), i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!homeMenu.hidden && !homeMenu.contains(e.target) && !homeToggle.contains(e.target)) setHome(false);
    });
    homeMenu.addEventListener('focusout', function (e) {
      if (!homeMenu.hidden && e.relatedTarget && !homeMenu.contains(e.relatedTarget) && e.relatedTarget !== homeToggle) setHome(false);
    });
    $$('a', homeMenu).forEach(function (a) { a.addEventListener('click', function () { setHome(false); }); });
  }

  /* ---------- Mobile sheet ---------- */
  var navToggle = $('#nav-toggle');
  var sheet = $('#nav-sheet');
  var NAV_BP = 1280;
  function setSheet(open, returnFocus) {
    if (!navToggle || !sheet) return;
    sheet.hidden = !open;
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    var o = $('.icon-open', navToggle), s = $('.icon-shut', navToggle);
    if (o) o.toggleAttribute('hidden', open);
    if (s) s.toggleAttribute('hidden', !open);
    document.body.classList.toggle('nav-open', open);
    if (open) { var first = $('a, button', sheet); if (first) first.focus(); }
    else if (returnFocus) navToggle.focus();
  }
  if (navToggle && sheet) {
    navToggle.addEventListener('click', function () { setSheet(navToggle.getAttribute('aria-expanded') !== 'true'); });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { setSheet(false); }); });
    sheet.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled])', sheet).filter(function (el) { return el.offsetParent !== null; });
      f.unshift(navToggle);
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= NAV_BP && !sheet.hidden) setSheet(false); });
  }
  var sheetHome = $('#sheet-home-toggle');
  if (sheetHome) {
    sheetHome.addEventListener('click', function () {
      var open = sheetHome.getAttribute('aria-expanded') !== 'true';
      sheetHome.setAttribute('aria-expanded', open ? 'true' : 'false');
      $('#sheet-home').hidden = !open;
      var use = $('use', sheetHome);
      if (use) use.setAttribute('href', open ? '#i-minus' : '#i-plus');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (homeMenu && !homeMenu.hidden) setHome(false, true);
    else if (sheet && !sheet.hidden) setSheet(false, true);
  });

  /* ---------- Sticky enroll bar (small screens) ---------- */
  var bar = $('#enroll-bar');
  if (bar) {
    document.body.classList.add('has-enroll-bar');
    var ticking = false;
    var onScroll = function () {
      ticking = false;
      bar.classList.toggle('is-visible', window.scrollY > Math.min(520, window.innerHeight * 0.6));
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  // registered after the enroll bar so each frame reads the bar state that frame already settled
  /* ---------- Scroll to top ---------- */
  var toTop = $('#to-top');
  if (toTop) {
    var topTicking = false;
    var updateTop = function () {
      topTicking = false;
      toTop.hidden = window.scrollY < Math.max(600, window.innerHeight * 0.9);
      // sit above the sticky enroll bar whenever that bar is showing
      var eb = $('#enroll-bar');
      var barUp = eb && getComputedStyle(eb).display !== 'none';
      var docked = !!barUp && !toTop.hidden;
      toTop.classList.toggle('in-bar', docked);
      document.body.classList.toggle('to-top-docked', docked);
      if (barUp) toTop.style.setProperty('--bar-h', eb.offsetHeight + 'px');
      if (!docked) {
        // free-floating: fit the button inside the lane between the viewport edge and the content column,
        // so it never sits on top of text, links or controls (44px max, 28px min, centred in the lane)
        var w = $('main .wrap') || $('.site-footer .wrap');
        if (w) {
          var rect = w.getBoundingClientRect(), cs = getComputedStyle(w);
          var vw = document.documentElement.clientWidth;
          var rtl = root.getAttribute('dir') === 'rtl';
          var lane = rtl ? rect.left + parseFloat(cs.paddingLeft) : vw - (rect.right - parseFloat(cs.paddingRight));
          var size = Math.max(28, Math.min(44, lane - 8));
          toTop.style.setProperty('--tt-size', size + 'px');
          toTop.style.setProperty('--tt-inset', Math.max(2, (lane - size) / 2) + 'px');
        }
      }
    };
    window.addEventListener('scroll', function () { if (!topTicking) { topTicking = true; requestAnimationFrame(updateTop); } }, { passive: true });
    window.addEventListener('resize', updateTop);
    new MutationObserver(updateTop).observe(root, { attributes: true, attributeFilter: ['dir'] });
    toTop.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      // move focus to the top of the page for keyboard and screen-reader users, without a second scroll
      var target = document.querySelector('#site-header .brand') || document.body;
      if (target.focus) target.focus({ preventScroll: true });
    });
    updateTop();
  }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Tabs (Home 1 process selector) ---------- */
  $$('[data-tabs]').forEach(function (group) {
    var tabs = $$('[role="tab"]', group);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[n]) panels[n].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, rtl = root.getAttribute('dir') === 'rtl', n = tabs.length, next = null;
        if (k === 'ArrowDown' || k === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = (i + 1) % n;
        else if (k === 'ArrowUp' || k === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = (i - 1 + n) % n;
        else if (k === 'Home') next = 0;
        else if (k === 'End') next = n - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });
    select(Math.max(0, tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; })));
  });

  /* ---------- Horizontal scrollers (Home 2 "day at the bench") ---------- */
  $$('[data-scroller]').forEach(function (wrap) {
    var track = $('[data-scroller-track]', wrap);
    var prev = $('[data-scroller-prev]', wrap);
    var next = $('[data-scroller-next]', wrap);
    if (!track) return;
    function step() { var item = track.firstElementChild; return item ? item.getBoundingClientRect().width + 16 : track.clientWidth * 0.8; }
    function update() {
      var rtl = root.getAttribute('dir') === 'rtl';
      var max = track.scrollWidth - track.clientWidth - 2;
      var pos = Math.abs(track.scrollLeft);
      if (prev) prev.disabled = pos <= 2;
      if (next) next.disabled = pos >= max;
      if (prev) prev.setAttribute('aria-disabled', prev.disabled ? 'true' : 'false');
      if (next) next.setAttribute('aria-disabled', next.disabled ? 'true' : 'false');
      void rtl;
    }
    function go(d) { track.scrollBy({ left: d * step() * (root.getAttribute('dir') === 'rtl' ? -1 : 1), behavior: 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- Expanding panels (Home 2 careers) ---------- */
  $$('[data-panels]').forEach(function (group) {
    var items = $$('[data-panel]', group);
    function open(i) {
      items.forEach(function (it, n) {
        var on = n === i;
        it.classList.toggle('is-open', on);
        var b = $('[data-panel-btn]', it);
        if (b) {
          b.setAttribute('aria-expanded', on ? 'true' : 'false');
          var use = $('use', b);
          if (use) use.setAttribute('href', on ? '#i-minus' : '#i-plus');
        }
      });
    }
    items.forEach(function (it, i) {
      var b = $('[data-panel-btn]', it);
      if (!b) return;
      b.addEventListener('click', function () { open(i); });
      it.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) open(i); });
    });
    open(0);
  });

  /* ---------- Enquiry form (validates; nothing is sent and delivery is never claimed) ---------- */
  $$('[data-demo-form]').forEach(function (form) {
    var summary = $('#form-errors', form);
    var msg = $('#f-msg', form);
    var counter = $('[data-count]', form);
    var rules = [
      { el: $('#f-name', form), label: 'Full name', test: function (v) { return v.trim().length >= 2 ? '' : (v.trim() ? 'Enter at least 2 characters.' : 'Enter your full name.'); } },
      { el: $('#f-email', form), label: 'Email address', test: function (v) { v = v.trim(); if (!v) return 'Enter your email address.'; return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter an email address like name@example.com.'; } },
      { el: $('#f-phone', form), label: 'Phone', test: function (v) { v = v.trim(); if (!v) return ''; return /^[+()\d\s-]{6,30}$/.test(v) && (v.match(/\d/g) || []).length >= 6 ? '' : 'Use digits, spaces, + ( ) and - only, with at least 6 digits.'; } },
      { el: $('#f-topic', form), label: 'Topic', test: function (v) { return v ? '' : 'Choose a topic.'; } },
      { el: msg, label: 'Your question', test: function (v) { var n = v.trim().length; if (!n) return 'Enter your question.'; return n >= 20 ? '' : 'Add a little more detail: at least 20 characters (' + n + ' so far).'; } }
    ];
    function show(rule, message) {
      var err = document.getElementById(rule.el.id + '-err');
      rule.el.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) { err.textContent = message; err.hidden = !message; }
    }
    function check(rule) { var m = rule.test(rule.el.value); show(rule, m); return m; }
    rules.forEach(function (rule) {
      // validate on leaving a field; once a field is invalid, re-check while typing so the error clears as soon as it is fixed
      // skip when focus is moving to this form's submit/reset button: an error appearing mid-click would shift the
      // button and swallow the click; the submit handler validates every field anyway
      rule.el.addEventListener('blur', function (e) {
        var to = e.relatedTarget;
        if (to && form.contains(to) && (to.type === 'submit' || to.type === 'reset')) return;
        if (rule.el.value || rule.el.getAttribute('aria-invalid') === 'true') check(rule);
      });
      rule.el.addEventListener('input', function () { if (rule.el.getAttribute('aria-invalid') === 'true') check(rule); });
      rule.el.addEventListener('change', function () { if (rule.el.getAttribute('aria-invalid') === 'true') check(rule); });
    });
    if (msg && counter) msg.addEventListener('input', function () { counter.textContent = msg.value.length; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // no backend is connected: nothing is ever sent or stored
      var failed = rules.map(function (r) { return { r: r, m: check(r) }; }).filter(function (x) { return x.m; });
      if (failed.length) {
        var list = $('[data-error-list]', summary);
        list.innerHTML = '';
        failed.forEach(function (x) {
          var li = document.createElement('li'); var a = document.createElement('a');
          a.href = '#' + x.r.el.id; a.textContent = x.r.label + ': ' + x.m;
          a.addEventListener('click', function (ev) { ev.preventDefault(); x.r.el.focus(); });
          li.appendChild(a); list.appendChild(li);
        });
        $('[data-error-count]', summary).textContent = failed.length === 1 ? '1 problem' : failed.length + ' problems';
        summary.hidden = false;
        summary.focus();
        return;
      }
      summary.hidden = true;
    });
    form.addEventListener('reset', function () {
      rules.forEach(function (r) { show(r, ''); });
      summary.hidden = true;
      if (counter) counter.textContent = '0';
    });
  });

  /* ---------- General map: raise the fallback if the provider cannot load ---------- */
  $$('[data-map]').forEach(function (map) {
    var frame = $('[data-map-frame]', map);
    if (!frame) return;
    var loaded = false, timer = null;
    function fail() { if (!loaded) map.classList.add('is-failed'); }
    frame.addEventListener('load', function () { loaded = true; if (timer) clearTimeout(timer); });
    frame.addEventListener('error', fail);
    if (navigator.onLine === false) { fail(); return; }
    // the frame is lazy: start the clock only once it is close to the viewport
    // an iframe still fires "load" when the browser shows its own error page, so also probe the provider directly:
    // an opaque no-cors request resolves when the server is reachable and rejects on a network failure
    var probe = function () {
      if (!window.fetch) return;
      var origin = frame.src.split('/').slice(0, 3).join('/');
      fetch(origin + '/favicon.ico?probe=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(function () { loaded = false; fail(); });
    };
    var started = false;
    var start = function () { if (started) return; started = true; probe(); if (!loaded) timer = setTimeout(fail, 15000); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) { start(); io.disconnect(); } }, { rootMargin: '200px' });
      io.observe(map);
    } else { start(); }
    window.addEventListener('offline', fail);
    // focus inside a cross-origin frame never matches :focus in this document, so flag it for the focus ring
    var setFocus = function () { map.classList.toggle('is-focused', document.activeElement === frame); };
    var syncFocus = function () { setFocus(); setTimeout(setFocus, 0); };
    window.addEventListener('blur', syncFocus);
    window.addEventListener('focus', syncFocus);
    document.addEventListener('focusin', syncFocus);
  });

  /* ---------- Init ---------- */
  applyTheme(currentTheme());
  applyDir(root.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr');
})();
