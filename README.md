# Welding Trade School

Static multi-page site (HTML + Tailwind CSS + vanilla JS). No framework, no runtime includes.

## Edit and build

| What | Where |
|---|---|
| Pages (source) | `src/pages/*.html`. The root `*.html` files are **build output**. Edit the sources. |
| Shared header / footer / head / icon sprite | `partials/*.html` (one copy, stamped into every page) |
| Design tokens + shared components | `src/input.css` (themes, section tones, buttons, header, footer) |
| Per-homepage styles | `src/css/home-1.css`, `src/css/home-2.css` |
| Behaviour | `assets/js/main.js` |
| Photos | `scripts/image-manifest.json` is the single list of photos; `assets/images/CREDITS.json` is generated |

```
npm run build          # pages + CSS
npm run build:images   # (re)download from Wikimedia Commons, write credits, optimize (needs network)
node scripts/build-images.js --offline   # re-optimize from the local cache only
npm start              # http://localhost:3000
```

Picture tokens in page sources: `{{pic key="h1-hero" alt="..." sizes="..." pos="50% 40%" eager}}`.

## Design system

Two themes (light / dark) x four section tones (`tone-paper`, `tone-alt`, `tone-ink`, `tone-arc`). Components use only
semantic tokens (`--bg --fg --fg-2 --fg-3 --acc --ui --soft --surf --p-*`), each measured for WCAG 2.2 AA.
Arc orange `#FF5A1F` is only ever a **fill** (with `#14161A` text) or, on dark tones, accent text; in light tones the
accent text colour is `#A33200`.

## Inner pages

Every inner page starts with `<section class="inner-hero ...">`. The shared rule lives in `src/input.css` (`--inner-hero-h: clamp(26rem, 54svh, 32rem)`):
the hero is never shorter than that and, from 1024px up, content must fit inside it, so all inner heroes share one height.
Each page supplies its own composition (see `src/css/programs.css`). Stacked mobile heroes are content-driven.
Photos for a page use the `pg-` style key prefix and live in their own folder (`assets/images/programs/`), never shared with another page.

## Quality gates (run against `npm start`)

```
npm run test:coverage   # core business information on both homepages; structural difference; no unverified claims
npm run test:images     # unique photo per page, credits, alt, weight, all images load
npm run test:programs   # Programs page: content, no unverified facts, anchors, hero height rule at 8 viewports, light/dark, LTR/RTL
npm run test:functional # console errors, links, shared shell, theme/dir persistence, menus, tabs, panels
npm run test:viewport   # 8 required viewports + intermediate widths, both themes: overflow, clipping, hero fit
npm run test:contrast   # every text node, icon, control boundary, hover/selected/open state and focus ring
npm test                # all of the above
```

## Shared shell

- Header: Home (Home 1 / Home 2), Programs, Instructors, About, Contact, Dashboard. There is no separate dashboard page; the
  dashboard sits behind the student portal, so **Dashboard links to `login.html`** until a dashboard route exists.
- Theme and direction controls have accessible names only (no `title` tooltips). The mobile menu has an equal-width
  Light / Dark pair (`[data-set-theme]`).
- One scroll-to-top button (`#to-top`, rendered by `partials/footer.html`): free-floating in the side margin on wide
  screens (sized by JS to fit between the viewport edge and the content column), docked inside the sticky enroll bar on
  small screens; instant scroll with reduced motion.
- Footer social icons are **not links**: no verified profile URLs exist. Add real URLs in `partials/footer.html`
  (turn each `span.social-icon` into an `a` with `target="_blank" rel="noopener"` and update its label).
- `npm run test:shell` checks all of this on every page at the 7 required viewports.

## Contact page map

The Contact page shows a **general** interactive OpenStreetMap embed of a default area (Chennai, India), configured in
`partials/location.json` (`generalMap`: label, bbox, center, zoom). It has no pin and is labelled as a general map that
does not show the school's location. No school address is recorded anywhere. If the provider cannot load (offline, blocked,
or no response within 15 s) a fallback message with an "Open the map" link replaces it. `test/contact.js` checks zoom, drag,
the fallback, the absence of a pin, and the labelling.

## Contact form

The enquiry form on `contact.html` is a labelled frontend demonstration: it validates every field but sends nothing and
says so. To make it live, connect it to a form handler and change the result message in `src/pages/contact.html`.

## Content that still needs real facts

The site deliberately states no school-specific facts that were not supplied: no address, phone, email, founding date,
accreditation, class sizes, schedules, tuition, named certifications, instructor names or student outcomes.
Add them in `partials/footer.html` and the page sources when available.

Photos are credited on `credits.html` (generated from `assets/images/CREDITS.json`). Pre-redesign files are archived in
`_legacy/` and `assets/images/_legacy/` and can be deleted.
