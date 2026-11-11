# Home layout assets + remove MultiShop `main.js`

## Goals

1. **Home (`/`):** Do not load Fancybox, Bootstrap Slider, or their CSS (conditional in [`views/layout.ejs`](views/layout.ejs) via existing `isHome` / `isHomePage`).
2. **Remove [`public/MultiShop/js/main.js`](public/MultiShop/js/main.js) entirely** from the layout — no script tag on any page.
3. **Move the only needed behavior from `main.js` into [`public/js/site.js`](public/js/site.js):** floating **back-to-top** (`.back-to-top` in layout).
   - **Scroll to top:** Use the **browser’s smooth scroll**, not jQuery `animate` with a named easing — e.g. `window.scrollTo({ top: 0, behavior: 'smooth' })` in the click handler (no easing plugin, no `$.animate(..., 'linear')`).
   - **Show/hide:** Keep equivalent UX — e.g. `$(window).scroll` + `fadeIn`/`fadeOut` on `.back-to-top`, or vanilla `scroll` + class toggles; either is fine as long as scroll-to-top is native smooth scroll.
4. **Remove [`public/MultiShop/lib/easing/easing.min.js`](public/MultiShop/lib/easing/easing.min.js)** from layout — project code does not use `jQuery.easing` custom curves; safe to drop with `main.js`.
5. **Combine [`public/js/script.js`](public/js/script.js) + [`public/js/site.js`](public/js/site.js)** into one file and one `<script>` tag (order: `script.js` then `site.js` content), update [`views/layout.ejs`](views/layout.ejs), remove standalone `site.js`, fix references (e.g. [`views/shop.ejs`](views/shop.ejs) comment).

## Implementation notes

- **`initBackToTop` in `script.js`** currently targets `#footerTopButton` only. After moving MultiShop `.back-to-top` into `site.js`, avoid duplicate handlers on the same element if both exist — either one init for both selectors or ensure only one button type per page.
- **Non-home pages** still need Fancybox + Bootstrap Slider assets where used (shop, pages, projects, etc.).

## Verification

- `/`: no Fancybox/Slider assets; back-to-top works; featured Swiper still works.
- `/shop`: price sliders + filters work.
- `npm run build` per project rule if any TS changes (likely none).
