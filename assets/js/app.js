/**
 * Welding Trade School — student portal (static demo).
 * Dashboard: view switching, responsive drawer, demo enrollment (in memory only), lab-hour and exam rendering.
 * Login: Sign In / Register tabs, client-side validation, show/hide password.
 * Nothing is sent, stored or authenticated. Theme and direction come from main.js.
 */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var app = document.body.getAttribute('data-app');

  /* =====================================================================
     DEMO DATA — one source of truth; every displayed figure is derived from it.
     Illustrative only: not a real student, programme, exam or record.
     ===================================================================== */
  var DEMO = {
    requiredHours: 120,
    // completed hours are the sum of these sessions, so totals always agree
    sessions: [
      ['2026-10-16', 'MIG / GMAW', 4], ['2026-10-14', 'TIG / GTAW', 3], ['2026-10-12', 'Stick / SMAW', 4],
      ['2026-10-09', 'MIG / GMAW', 4], ['2026-10-07', 'TIG / GTAW', 3], ['2026-10-05', 'MIG / GMAW', 4],
      ['2026-10-02', 'Stick / SMAW', 4], ['2026-09-30', 'MIG / GMAW', 4], ['2026-09-28', 'TIG / GTAW', 3],
      ['2026-09-25', 'MIG / GMAW', 4], ['2026-09-23', 'Stick / SMAW', 4], ['2026-09-21', 'MIG / GMAW', 4],
      ['2026-09-18', 'TIG / GTAW', 3], ['2026-09-16', 'MIG / GMAW', 4], ['2026-09-14', 'Stick / SMAW', 4],
      ['2026-09-11', 'MIG / GMAW', 4], ['2026-09-09', 'TIG / GTAW', 3], ['2026-09-07', 'MIG / GMAW', 4],
      ['2026-09-04', 'Stick / SMAW', 4], ['2026-09-02', 'MIG / GMAW', 4], ['2026-08-31', 'TIG / GTAW', 2]
    ],
    // sample options built from the three processes the school teaches (summaries from the public Programs page)
    options: [
      { id: 'mig', process: 'MIG / GMAW', summary: 'Continuous-wire welding, widely used in fabrication and production work.', href: 'programs.html#mig' },
      { id: 'tig', process: 'TIG / GTAW', summary: 'Tungsten-arc welding with hand-fed filler, used where precision matters.', href: 'programs.html#tig' },
      { id: 'stick', process: 'Stick / SMAW', summary: 'Flux-coated electrode welding for structural, field and repair work.', href: 'programs.html#stick' }
    ],
    // neutral sample entries; no official names, scores or certification outcomes
    exams: [
      { name: 'Sample assessment 1: MIG practical', date: '2026-09-19', state: 'result', label: 'Demo result', detail: 'Reviewed', next: 'No action needed' },
      { name: 'Sample assessment 2: TIG practical', date: '2026-11-06', state: 'pending', label: 'Pending', detail: 'Scheduled (sample date)', next: 'Practise TIG technique at the booth' },
      { name: 'Sample certification assessment', date: null, state: 'na', label: 'Not available', detail: 'Opens after lab hours are complete', next: 'Complete the remaining lab hours' }
    ]
  };

  var fmtDate = function (iso) {
    if (!iso) return 'Not scheduled';
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  if (app === 'dashboard') {
    var completed = DEMO.sessions.reduce(function (t, s) { return t + s[2]; }, 0);
    var required = DEMO.requiredHours;
    var remaining = Math.max(0, required - completed);
    var percent = Math.round((completed / required) * 100);

    // ---- lab hours (every occurrence) ----
    $$('[data-lab="completed"]').forEach(function (e) { e.textContent = completed; });
    $$('[data-lab="required"]').forEach(function (e) { e.textContent = required; });
    $$('[data-lab="remaining"]').forEach(function (e) { e.textContent = remaining; });
    $$('[data-lab="percent"]').forEach(function (e) { e.textContent = percent; });
    $$('[data-lab="status"]').forEach(function (e) {
      e.textContent = remaining === 0 ? 'Complete (demo): all sample hours recorded.' : 'In progress (demo): ' + remaining + ' of ' + required + ' sample hours remaining.';
    });
    $$('[data-lab-progress]').forEach(function (bar) {
      bar.setAttribute('aria-valuemax', required);
      bar.setAttribute('aria-valuenow', completed);
      bar.setAttribute('aria-valuetext', completed + ' of ' + required + ' hours (' + percent + '%), demo data');
      $('i', bar).style.width = percent + '%';
    });
    var tbody = $('[data-sessions] tbody');
    if (tbody) {
      var recent = DEMO.sessions.slice(0, 6);
      tbody.innerHTML = recent.map(function (s) {
        return '<tr><td data-label="Date">' + fmtDate(s[0]) + '</td><td data-label="Process">' + esc(s[1]) + '</td><td data-label="Hours" class="num"><span dir="ltr">' + s[2] + ' h</span></td></tr>';
      }).join('');
      var note = $('[data-sessions-note]');
      if (note) note.textContent = 'Showing the 6 most recent of ' + DEMO.sessions.length + ' sample sessions. All ' + DEMO.sessions.length + ' add up to the ' + completed + ' completed hours shown above.';
    }

    // ---- exams ----
    var etb = $('[data-exams] tbody');
    if (etb) {
      etb.innerHTML = DEMO.exams.map(function (x) {
        var icon = x.state === 'result' ? 'i-check' : x.state === 'pending' ? 'i-clock' : 'i-minus';
        // full class names written out (the CSS build only keeps classes it can find in the source)
        var cls = { result: 'status-result', pending: 'status-pending', na: 'status-na' }[x.state];
        return '<tr><th scope="row" data-label="Assessment">' + esc(x.name) + '</th>' +
          '<td data-label="Date">' + fmtDate(x.date) + '</td>' +
          '<td data-label="Status"><span class="status ' + cls + '"><svg class="icon" aria-hidden="true"><use href="#' + icon + '"/></svg>' + esc(x.label) + '</span><span class="status-detail">' + esc(x.detail) + '</span></td>' +
          '<td data-label="Next step">' + esc(x.next) + '</td></tr>';
      }).join('');
    }
    var nextExam = DEMO.exams.filter(function (x) { return x.state === 'pending'; })[0];
    $$('[data-next-exam]').forEach(function (e) {
      e.innerHTML = nextExam ? '<b>' + esc(nextExam.name) + '</b><span>' + fmtDate(nextExam.date) + ' &middot; Pending</span>' : 'No assessment pending.';
    });

    // ---- demo enrollment (in memory only; never stored or sent) ----
    var selected = null;
    var list = $('[data-programs]');
    var status = $('[data-enroll-status]');
    function renderPrograms() {
      list.innerHTML = DEMO.options.map(function (o) {
        var on = selected === o.id;
        return '<li class="prog' + (on ? ' is-selected' : '') + '">' +
          '<div class="prog-main"><p class="prog-k">Sample option</p><h3 class="prog-h">' + esc(o.process) + ' track</h3>' +
          '<p class="prog-s">' + esc(o.summary) + '</p></div>' +
          '<div class="prog-actions">' +
          (on ? '<span class="status status-selected"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Selected (demo)</span>' : '') +
          '<a class="btn btn-secondary btn-sm" href="' + o.href + '">View program<span class="sr-only">: ' + esc(o.process) + '</span></a>' +
          (on
            ? '<button type="button" class="btn btn-secondary btn-sm" data-enroll-clear>Clear selection<span class="sr-only">: ' + esc(o.process) + '</span></button>'
            : '<button type="button" class="btn btn-primary btn-sm" data-enroll="' + o.id + '">Enroll<span class="sr-only">: ' + esc(o.process) + ' (demo)</span></button>') +
          '</div></li>';
      }).join('');
      var sel = DEMO.options.filter(function (o) { return o.id === selected; })[0];
      $$('[data-enroll-summary]').forEach(function (e) {
        e.innerHTML = sel ? '<b>' + esc(sel.process) + ' track</b><span>Demo selection only. Nothing has been submitted.</span>' : 'No sample option selected.';
      });
    }
    if (list) {
      renderPrograms();
      list.addEventListener('click', function (e) {
        var b = e.target.closest('[data-enroll], [data-enroll-clear]');
        if (!b) return;
        var id = b.getAttribute('data-enroll');
        var prev = selected;
        selected = id || null;
        renderPrograms();
        var sel = DEMO.options.filter(function (o) { return o.id === selected; })[0];
        status.innerHTML = sel
          ? '<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg><span><b>Demo enrollment selected: ' + esc(sel.process) + ' track.</b> No real enrollment has been submitted. To enroll, contact admissions.</span>'
          : '<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg><span>Demo selection cleared.</span>';
        status.classList.add('is-on');
        // keep keyboard focus on the matching control after re-render
        var again = sel ? $('[data-enroll-clear]', list) : $('[data-enroll="' + prev + '"]', list);
        (again || status).focus();
      });
    }

    // ---- views (hash navigation) ----
    var views = $$('[data-view]');
    var titles = { overview: 'Overview', programs: 'Certification Programs', 'lab-hours': 'Lab Hours', exams: 'Exam Results' };
    function show(name, focus) {
      if (!titles[name]) name = 'overview';
      views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
      $$('.app-nav [data-view-link]').forEach(function (a) {
        if (a.getAttribute('data-view-link') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      var t = $('[data-view-title]'); if (t) t.textContent = titles[name];
      document.title = titles[name] + ' | Student Dashboard (Demo) | Welding Trade School';
      if (focus) { var m = $('#app-main'); m.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    }
    root.classList.add('js-views');
    window.addEventListener('hashchange', function () { show(location.hash.slice(1), true); closeDrawer(false); });
    show(location.hash.slice(1), false);

    // ---- drawer (below 1024px) ----
    var drawer = $('[data-drawer]');
    var openBtn = $('[data-drawer-open]');
    var closeBtn = $('[data-drawer-close]');
    var backdrop = $('[data-drawer-backdrop]');
    var body = $('[data-app-body]');
    var mq = window.matchMedia('(max-width: 1023.98px)');
    function setInert(el, on) { if (!el) return; if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); } else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); } }
    function openDrawer() {
      document.body.classList.add('drawer-open');
      backdrop.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      setInert(body, true);
      drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true');
      var first = $('.app-nav a[aria-current]', drawer) || $('a, button', drawer);
      setTimeout(function () { first.focus(); }, 20);
    }
    function closeDrawer(returnFocus) {
      if (!document.body.classList.contains('drawer-open')) return;
      document.body.classList.remove('drawer-open');
      backdrop.hidden = true;
      openBtn.setAttribute('aria-expanded', 'false');
      setInert(body, false);
      drawer.removeAttribute('role'); drawer.removeAttribute('aria-modal');
      if (returnFocus) openBtn.focus();
    }
    function syncDrawer() {
      // on desktop the sidebar is always visible and never modal; in drawer mode it is hidden until opened
      if (!mq.matches) { closeDrawer(false); setInert(drawer, false); }
      else if (!document.body.classList.contains('drawer-open')) setInert(drawer, true);
    }
    if (drawer && openBtn) {
      openBtn.addEventListener('click', function () { setInert(drawer, false); openDrawer(); });
      closeBtn.addEventListener('click', function () { closeDrawer(true); syncDrawer(); });
      backdrop.addEventListener('click', function () { closeDrawer(true); syncDrawer(); });
      $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { if (mq.matches) { closeDrawer(false); syncDrawer(); } }); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) { closeDrawer(true); syncDrawer(); }
        if (e.key === 'Tab' && document.body.classList.contains('drawer-open')) {
          var f = $$('a[href], button:not([disabled])', drawer).filter(function (el) { return el.offsetParent !== null; });
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      if (mq.addEventListener) mq.addEventListener('change', syncDrawer); else mq.addListener(syncDrawer);
      syncDrawer();
    }
  }

  /* =====================================================================
     LOGIN PORTAL
     ===================================================================== */
  if (app === 'login') {
    // ---- tabs ----
    var tabs = $$('.auth-tabs [role="tab"]');
    function selectTab(name, focusTab) {
      tabs.forEach(function (t) {
        var on = t.id === 'tab-' + name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        if (on && focusTab) t.focus();
      });
      // a result message from the other form must not linger
      $$('.auth-result').forEach(function (r) { r.hidden = true; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t.id.replace('tab-', '')); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') n = (i + 1) % tabs.length; // two tabs: either arrow moves to the other
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); selectTab(tabs[n].id.replace('tab-', ''), true); }
      });
    });
    $$('[data-auth-switch]').forEach(function (b) {
      b.addEventListener('click', function () {
        var to = b.getAttribute('data-auth-switch');
        selectTab(to);
        var first = $('#panel-' + to + ' input');
        if (first) first.focus();
      });
    });

    // ---- show / hide password ----
    $$('[data-pw-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById(b.getAttribute('data-pw-toggle'));
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', show ? 'true' : 'false');
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        $('use', b).setAttribute('href', show ? '#i-eye-off' : '#i-eye');
      });
    });

    // ---- validation (values stay in the inputs; nothing is stored or sent) ----
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var rulesFor = {
      signin: [
        ['si-email', function (v) { return !v.trim() ? 'Enter your email.' : EMAIL.test(v.trim()) ? '' : 'Enter an email like name@example.com.'; }],
        ['si-pass', function (v) { return v ? '' : 'Enter your password.'; }]
      ],
      register: [
        ['rg-name', function (v) { return v.trim().length >= 2 ? '' : 'Enter your full name.'; }],
        ['rg-email', function (v) { return !v.trim() ? 'Enter your email.' : EMAIL.test(v.trim()) ? '' : 'Enter an email like name@example.com.'; }],
        ['rg-pass', function (v) { return !v ? 'Create a password.' : v.length >= 8 ? '' : 'Use at least 8 characters.'; }],
        ['rg-pass2', function (v) { return !v ? 'Confirm your password.' : v === document.getElementById('rg-pass').value ? '' : 'Passwords do not match.'; }]
      ]
    };
    var MESSAGES = {
      signin: '<b>Sign-in is not connected.</b> This is a static demo portal, so your details were not checked and you have not been signed in. Nothing was sent or saved.',
      register: '<b>Registration is not connected.</b> This is a static demo portal, so no account has been created. Nothing was sent or saved.'
    };
    function show(id, msg) {
      var el = document.getElementById(id), err = document.getElementById(id + '-err');
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.textContent = msg; err.hidden = !msg;
    }
    $$('[data-auth-form]').forEach(function (form) {
      var kind = form.getAttribute('data-auth-form');
      var rules = rulesFor[kind];
      var result = $('.auth-result', form);
      rules.forEach(function (r) {
        var el = document.getElementById(r[0]);
        el.addEventListener('blur', function (e) {
          var to = e.relatedTarget;
          if (to && form.contains(to) && to.type === 'submit') return; // the submit handler validates everything
          if (el.value || el.getAttribute('aria-invalid') === 'true') show(r[0], r[1](el.value));
        });
        el.addEventListener('input', function () {
          result.hidden = true;
          if (el.getAttribute('aria-invalid') === 'true') show(r[0], r[1](el.value));
          // keep the confirmation in step with the password
          if (r[0] === 'rg-pass') { var c = document.getElementById('rg-pass2'); if (c.getAttribute('aria-invalid') === 'true' || c.value) show('rg-pass2', rules[3][1](c.value)); }
        });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); // never submitted anywhere
        var bad = rules.map(function (r) { var m = r[1](document.getElementById(r[0]).value); show(r[0], m); return m ? r[0] : null; }).filter(Boolean);
        if (bad.length) { result.hidden = true; document.getElementById(bad[0]).focus(); return; }
        result.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg><span>' + MESSAGES[kind] + '</span>';
        result.hidden = false;
        result.focus();
      });
    });
  }
})();
