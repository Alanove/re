# Luxury-style homepage + New Arrival flag + Antonios brand assets

## Brand assets (this iteration)

### Custom font — `docs/antonios-font.ttf` → webfonts

- **Source file:** [`docs/antonios-font.ttf`](../../docs/antonios-font.ttf) (ensure it is committed or present locally; it was not found in a quick repo scan—add the file if missing).
- **Conversion:** Generate **`woff2`** (primary) and optional **`woff`** fallback for older browsers. Acceptable approaches:
  - One-time CLI (e.g. `woff2_compress` from [google/woff2](https://github.com/google/woff2), or a small devDependency such as `ttf2woff2`) and commit outputs; **or**
  - Document a manual step (e.g. Transfonter) if you prefer no extra tooling—still commit the generated files under `public/fonts/`.
- **Deliverables in repo:** e.g. `public/fonts/antonios-display.woff2` (+ `.woff` if used).
- **CSS:** `@font-face` in [`public/css/styles.scss`](../../public/css/styles.scss) (or a small `_fonts.scss` partial imported there) with `font-display: swap` and a sensible `font-family` name (e.g. `AntoniosDisplay`).
- **Usage:** Apply this family to **luxury homepage section headings** (“New Arrivals”, “Shop the look”, hero captions, service strip titles) and any other high-impact display text per design—not necessarily global body copy (keep existing sans for long UI text unless you want full-site rebrand).

### Logo — `docs/Antonios-Couture-LOGO.png`

- **Source file:** [`docs/Antonios-Couture-LOGO.png`](../../docs/Antonios-Couture-LOGO.png) (also referenced from Cursor assets path if synced).
- **Static serving:** Copy or symlink into **`public/images/`** (e.g. `public/images/antonios-couture-logo.png`) so the header can reference a stable URL.
- **Header behavior:** Centered logo in the new luxury bar should **`img`** this asset with appropriate `height` / `max-width` and `alt` text (“Antonios Couture”). **Fallback order:** if admin **`siteSettings.logo`** is set, keep honoring it; otherwise default to `public/images/antonios-couture-logo.png` so local/dev matches brand without DB setup.

**Homepage contrast:** If `body.home` uses a transparent header over the hero with **light** text/icons, ensure the logo reads well (PNG is dark gray on transparent—good on light hero areas; if heroes are dark, add a scoped CSS filter or provide a light variant later).

---

## Product field: `is_new_arrival`

- DB migration: `products.is_new_arrival` (boolean, default false, index optional).
- [`src/services/productService.ts`](../../src/services/productService.ts): `Product`, `ProductFilters`, `getProducts` WHERE clause.
- [`src/controllers/shopController.ts`](../../src/controllers/shopController.ts): query e.g. `new_arrival=true`.
- Admin: [`admin/services/productManagementService.ts`](../../admin/services/productManagementService.ts) (INSERT + `ProductCreateData`), [`admin/controllers/productsController.ts`](../../admin/controllers/productsController.ts), [`admin/views/products/product-settings-card.ejs`](../../admin/views/products/product-settings-card.ejs); optional list filter in [`admin/views/products/products.ejs`](../../admin/views/products/products.ejs).
- [`src/controllers/homeController.ts`](../../src/controllers/homeController.ts): load `newArrivalProducts`, `attachColorOptionsForListing`; pass to view.
- [`views/index.ejs`](../../views/index.ejs): “New Arrivals” row uses `newArrivalProducts`; “Shop All” → `/shop?new_arrival=true` (match existing URL conventions); update confirmation-modal guard.

---

## Header: centered logo + split nav

- Refactor [`views/partials/header.ejs`](../../views/partials/header.ejs): desktop row = **nav left | centered logo | nav right + utilities**; split CMS `items` into two halves with shared partial for mega/dropdown markup.
- Fold search/slogan from old topbar into the new bar (search on right; slogan optional elsewhere).
- Top announcement strip (thin white bar above nav) for messages such as “شحن مجاني إلى لبنان لجميع الطلبات” / promo text—pull from `siteSettings` or a CMS field if available, otherwise hardcode for now.

### Desktop mega menu (reference: ODLR-style)

- **Layout:** When a top-level item is hovered/clicked, the **entire bar background turns olive** (brand color) and a **full-width panel** drops down beneath the nav row.
- **Panel content:** flex row with **2/3 (left) of multi-column links** + **1/3 (right) editorial image** (use `randomFeaturedProduct` image already provided to header, or category image).
- **Link columns:** each column has an **underlined section heading** (e.g. `Featured`, `Bags & Accessories`, `Jewelry`, `Beauty`) followed by a vertical list of links; sourced from each top-level `item.children`. If children are flat, fall back to a single column.
- **Sticky open state:** clicking a top-level link toggles `body.menu-open`/active state on the nav so the **olive background + white text** apply to **header**, top utilities (`Search`, `Customer Care`, `Sign In`, `Bag (n)`), and the announcement bar (still legible) while the panel is open. Closes on outside click / ESC / mouseleave (whichever interaction the existing Bootstrap `data-toggle="dropdown"` already supports — keep it consistent).
- **Single source of truth:** extract the per-item rendering into a small partial (e.g. `views/partials/header-mega-item.ejs`) so left and right nav halves render identically.

### Mobile menu (reference: full-screen olive drawer)

- **Trigger:** existing hamburger toggler.
- **Drawer:** full-screen overlay (replaces current Bootstrap collapse pattern) with **olive background**, white serif heading at top, **`< Back`** at top-left and **`✕`** at top-right.
- **Two-level navigation:**
  - Level 1 — list of top-level items (Ready-to-Wear, Accessories, Discover, etc.).
  - Tapping an item slides to **Level 2** for that item: heading shows the item name (e.g. `READY-TO-WEAR`), then **grouped sections** (`Featured`, `Categories`, `Edits`) with underlined headings — same data structure as desktop mega panel, just stacked.
  - `< Back` returns to Level 1; `✕` closes drawer.
- Below nav: utility links (`Sign In`, `Bag`, `Search` opens the mobile search overlay below).
- **Mobile search overlay:** separate full-screen white sheet with input (`Search Here`), `Suggested terms:` chips and `Quick links:` row; opens from search icon. Optional in v1 — can stub with the existing `/shop?search=` form if low priority.
- **JS:** the existing Bootstrap collapse and `mega-menu-item` handlers in [`public/js/app.js`](../../public/js/app.js) won’t cover the two-level slide; add a small vanilla module in `public/js/site.js` (or new `public/js/mobile-menu.js`) that toggles `data-menu-level` on the drawer and listens for `.mobile-menu-back` / `.mobile-menu-close` clicks.

---

## Homepage sections — [`views/index.ejs`](../../views/index.ejs)

- Hero: full-bleed; caption typography uses **Antonios webfont** where appropriate.
- **New Arrivals:** `newArrivalProducts`, ~4-up row, existing card behavior.
- **Shop the look:** For each **featured** category, one row: left = title + description + ~3 product tiles; right = large `categoryListingImageUrl(category)`.
- Restyle service strip (3 columns, beige band); optional alternating row direction.
- Remove/replace tabbed “Shop by Category” UI; verify [`public/js/app.js`](../../public/js/app.js) tab handler vs [`views/shop.ejs`](../../views/shop.ejs) before deleting shared behavior.

---

## SCSS file structure

The build pipeline compiles a **single entry** `public/css/styles.scss` → `public/css/styles.css` (see `package.json` `scss` / `scss:once` / `scss-dev`). To keep the new design tidy without breaking that pipeline, use **Sass partials** (filename prefixed with `_`, not separately compiled) imported from the existing entry.

- **Create folder:** `public/css/home/` (new) holding all homepage- and chrome-related partials.
- **New partials (each underscore-prefixed):**
  - `public/css/home/_home.scss` — top-level home shell (`body.home` overrides, fonts, color tokens specific to home).
  - `public/css/home/_header.scss` — luxury header bar, announcement strip, **desktop mega menu** (olive open state, columns, editorial image), centered logo, utility cluster.
  - `public/css/home/_mobile-menu.scss` — full-screen drawer, two-level nav, `Back`/`✕`, mobile search overlay.
  - `public/css/home/_hero.scss` — full-bleed hero + caption styles.
  - `public/css/home/_new-arrivals.scss` — 4-up product row, card overrides.
  - `public/css/home/_shop-the-look.scss` — alternating editorial rows + 3-tile product grid.
  - `public/css/home/_service-strip.scss` — 3-column beige band.
  - `public/css/home/_footer.scss` — homepage footer treatment (only if it differs from global; otherwise scope under `body.home` here and leave global footer alone).
  - `public/css/home/_fonts.scss` — `@font-face` for Antonios webfont (kept separate so other entry points can reuse it later if needed).
- **Wire-up:** add `@use` (or `@import` to match existing convention in `styles.scss`) lines at the **bottom** of [`public/css/styles.scss`](../../public/css/styles.scss):

  ```scss
  @import 'home/fonts';
  @import 'home/home';
  @import 'home/header';
  @import 'home/mobile-menu';
  @import 'home/hero';
  @import 'home/new-arrivals';
  @import 'home/shop-the-look';
  @import 'home/service-strip';
  @import 'home/footer';
  ```

  Check whether the existing `styles.scss` uses `@use` with a namespace or classic `@import`; **mirror the existing style** to avoid mixed-import bugs.
- **Scoping:** every selector in these partials should be nested under `body.home` (or scoped class like `.luxury-header`) so the global storefront pages remain visually unchanged unless intentional.
- **No new compile script:** since these are partials and `styles.scss` is the single entry, the existing `npm run scss` continues to work; no `package.json` change needed.

---

## Verification

- `npm run build` after TS changes.
- Visual: font loads (network tab: woff2 200); logo centered; no FOUT flash beyond `font-display: swap`.
- Functional: admin toggles New Arrival; `/shop?new_arrival=true` filters.

---

## Implementation todos

1. Add SQL migration `is_new_arrival`; wire product service, shop + home controllers, admin UI.
2. Convert `docs/antonios-font.ttf` → `public/fonts/*.woff2` (+ optional woff); `@font-face` in `public/css/home/_fonts.scss`.
3. Add logo to `public/images/`; header default/fallback + centered layout markup.
4. Create `public/css/home/` SCSS partials (`_home`, `_header`, `_mobile-menu`, `_hero`, `_new-arrivals`, `_shop-the-look`, `_service-strip`, `_footer`, `_fonts`) and `@import` them from `styles.scss`.
5. Refactor `views/partials/header.ejs` — split desktop nav, centered logo, announcement strip, olive mega-menu open state, full-screen mobile drawer with two-level nav + Back/Close + mobile search overlay; small JS module for the drawer.
6. Rework `views/index.ejs` sections (hero, New Arrivals row, Shop-the-look stacked rows, service strip).
7. `npm run build`; grep `shop-by-category` JS before removing.
