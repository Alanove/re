# Legacy site transformation playbook

This playbook turns a legacy site of the "re-petroleum" family into a Node.js CMS site with a new design. Five more sites share the same legacy shape. Their designs differ; this pipeline does not.

The first site built with it is R&E Petroleum (`site/` in this repo). Throne Trading (`thronetrading/`) is the second and the latest finished site: it adds the product catalog (products, categories, brands) and the WebP media pipeline. Start new sites from `thronetrading/`; use R&E Petroleum only as the reference for brochure-style sites without a catalog.

## Legacy shape this playbook expects

- A content export workbook (`.xls`, BIFF) with at least these sheets:
  - `Pages`: `PageId`, `ParentId` (`-1` for top level), `URL` (slug), `Title`, `Header`, `SmallDescription`, `PageContent` (HTML), `Status` (`1` = published), `Image`, `Ranking`, `Keywords`, `DateModified`.
  - `PageImages`: `ImageId`, `PageId`, `Sort`, `Caption`, `FileName`, `Width`, `Height`.
  - Album sheets (`PhotoAlbums`, `PhotoAlbumImages`, ...) may exist and are empty on this family; the importer ignores them.
- Live URLs are nested by `ParentId`: `/parent-slug/child-slug`.
- Gallery photos live at `/Prv/Images/Pages/Page_{PageId}/Large/{FileName}` (thumbnails under `/Thumb/`). The original file at `Page_{PageId}/{FileName}` returns 404. Page hero images use `Page_{PageId}/{name}-l{ext}`. Inline content images often live at `/Prv/Images/Static/...`.
- Some inline content points at folders that no longer exist on the live server (`/images/pages/material-supply/`, `/re-pfm/...`). The downloader strips those `<img>` tags and unwraps those links.
- One page (here `contact-us-footer`) holds the footer office blocks. It is data, not a route.

If a new site differs from this shape, change the importer for that site and record the difference in its `transform.config.json` `legacy` block.

## Inputs (all variables, never hardcoded)

Every site has `site/transform.config.json`. Scripts read only this file for site-specific paths.

| Key | Meaning |
| --- | --- |
| `siteKey` | Short id, used for the session cookie name and logs |
| `siteName` | Public brand name |
| `legacySiteUrl` | Live legacy site; the only host images are downloaded from |
| `cmsSource` | Path of the CMS tree the admin assets are synced from |
| `contentWorkbook` | Path to the `.xls` export, relative to `site/` |
| `contentSeed` | Site copy the workbook does not hold (home sections, office overrides, settings, page icons, title fixes, asset aliases), relative to `site/` |
| `designDir` | Folder with the HTML design mocks, relative to `site/` |
| `outputDir` | Site root, normally `.` |
| `port` | Dev port (each site gets its own) |
| `logo` | `url` to download, `localPath` to save, and a `note` on which part of the file is used |
| `legacy` | Image path pattern, footer page key (`null` when the site has none), contact page key, uploads mirror prefix. Optional `localRoot`: a local copy of the legacy web root (relative to the site) that assets are read from before falling back to `legacySiteUrl`. Optional `hiddenPageKeys`: workbook pages that are imported as drafts and kept out of menus |
| `catalog` | Optional. Present only on catalog sites; see "Catalog sites" below |
| `cmsSync` | Admin static files and folders copied from `cmsSource` |

Blank config for the next site:

```json
{
  "siteKey": "",
  "siteName": "",
  "legacySiteUrl": "https://www.example.com",
  "cmsSource": "",
  "contentWorkbook": "../export.xls",
  "contentSeed": "content/seed.json",
  "designDir": "../design",
  "outputDir": ".",
  "port": 3041,
  "logo": { "url": "", "localPath": "/uploads/site/logo.png", "note": "" },
  "legacy": {
    "pageImagePattern": "/Prv/Images/Pages/Page_{pageId}/Large/{fileName}",
    "footerPageKey": "contact-us-footer",
    "contactPageKey": "contact-us",
    "uploadsMirrorPrefix": "/uploads/legacy"
  },
  "cmsSync": {
    "adminPublicFiles": ["css/vendor.min.css", "css/app.min.css", "js/vendor.min.js", "js/app.min.js", "js/custom.js"],
    "adminPublicDirs": ["css/images", "webfonts"]
  }
}
```

## What is shared and what is per site

Shared core (copy from the latest finished site, do not rewrite):

- `src/` server: Express 5, ESM TypeScript, Service-Repository layers, Zod schemas, Helmet, rate limits, CSRF, `asyncHandler`, one error middleware, scrypt passwords, session store.
- Admin modules: login, users, profile, dashboard, pages (with gallery), home sections, menus, site settings, offices, inquiries, image upload and the rich-text editor APIs. Catalog sites add Products (specs editor, gallery), Categories and Brands.
- Media: `imageProcessingService.ts` (sharp, WebP, size presets), `mediaService.ts`, `mediaRepository.ts`, `src/middleware/upload.ts`, the picker partial `admin/views/partials/media-picker.ejs`, and `scripts/check-media.ts`. See "Media pipeline" below and `.cursor/rules/cms-media.mdc`.
- `admin/views/` and `admin/public/js/re-admin.js`, `admin/public/js/editor-mount.js`, `admin/public/css/admin.scss`.
- Rich text editor: the reusable package `packages/rich-text-editor` (copy the folder next to the new site). `npm run editor:build` bundles it into `admin/public/editor/` (`editor.js`, `editor.css`, `rte-content.css`, `templates.json`, icons); commit that output. Public pages load `/admin/editor/rte-content.css` for template, image and table styles. Swatches and template colours read the `--color-*` variables emitted from `$css-colors` in `_tokens.scss`, so keep those names. The server sanitizer (`sanitizeService.ts`) keeps author HTML and strips only scripts, styles blocks, forms, embeds, event handlers, script URLs and iframes other than YouTube / Vimeo.
- `scripts/`: `sync-cms.ts`, `import-legacy.ts`, `download-assets.ts`, `seed-admin.ts`.
- `public/scss/` partial layout (`_tokens`, `_base`, `_layout`, `_header`, `_footer`, `_buttons`, `_cards`, `_bento`, `_forms`, `_hero`, `_inner-page`, `_gallery`, `_home`, `main.scss`).
- Build gates and the browser check after every UI change (`.cursor/rules/node-backend.mdc`).

Per site:

- `transform.config.json` values.
- `public/scss/_tokens.scss` values (palette, type scale, spacing, radii) from that site's design mocks.
- `views/` templates where the new design changes structure.
- `data/` content (generated by the importer, then edited in admin).
- Logo choice and crop, office list, colors, copy.

## Keep core, theme, and content apart

| Layer | Location | Replaced when a newer CMS is merged? |
| --- | --- | --- |
| CMS core | `src/`, `admin/`, `scripts/` | Yes |
| Admin theme assets | `admin/public/` (synced from `cmsSource`) | Yes, via `npm run cms:sync` |
| Public theme | `views/`, `public/scss/`, `public/js/` | No |
| Content | `data/`, `public/uploads/` | No |

Never put site copy or colors in `src/`. Never put data access in `views/`.

## Steps for a new site

1. Create `<site-folder>/site/` by copying the latest finished site, then delete its `data/*.json`, `public/uploads/`, `dist/`, and `node_modules/`.
2. Fill in `transform.config.json`.
3. `npm install`, then `npm run cms:sync` to copy admin theme assets from `cmsSource`.
4. Write `content/seed.json` for the site. Values prefixed `legacy:/path` become downloaded assets under `/uploads/legacy/path`; values prefixed `page:key` become that page's URL. `assetAliases` maps a dead legacy path to the path that works on the live server. Each `offices.<id>` override can set `mapQuery` (an address or place name); the Contact page shows a tabbed Google Map embed (`https://www.google.com/maps?q=...&output=embed`, no API key) for offices that have one, and editors can change it under Admin > Offices. `https://www.google.com` is in the CSP `frame-src` for this.
5. `npm run import:legacy` reads the workbook and the seed and writes `data/pages.json`, `data/menus.json`, `data/home.json`, `data/offices.json`, `data/page-images.json`, `data/settings.json`, and `data/asset-manifest.json`. Page HTML is sanitized, legacy image and document URLs are rewritten to `/uploads/legacy/...`, and legacy page links are rewritten to the new nested URLs. Empty leaf pages are imported as drafts. Add `--force` to re-import over existing data; users and inquiries are never touched.
   - Page HTML also passes through `scripts/lib/normalize-legacy-html.ts`, which repairs common CMS-editor markup:
     - Paragraphs that are only bold `N. TITLE` text become `<h3>` headings in title case.
     - Runs of `<p>- item</p>` become one `<ul>`.
     - Empty headings and paragraphs are dropped.
     - Links whose visible text is a domain get their `href` rebuilt from that text.
     - A table whose first row starts with an empty cell becomes a table with a `<thead>`; a headerless table directly after a matching headed table is merged into it; an `Origin`/`Country` column is title-cased with spelling fixes (`COUNTRY_FIXES`).
     - Every table is wrapped in `<div class="table-wrap">`.
     - An in-page anchor list (`<ul>` of `#links`) is rebuilt from the `<h2><a id>` anchors in order.
     - Three or more consecutive `<h3>` + `<ul>` pairs are grouped into `<div class="prose-grid">` cards.
   - The sanitizer allows only the classes `prose-grid`, `prose-card`, and `table-wrap` on `div` for this. Content already normalized is left alone.
   - The contact page's legacy body is not imported (`content` is empty); the Contact view renders offices from `data/offices.json`.
6. `npm run download:assets` downloads every manifest entry into `public/uploads/` (six at a time, trying each candidate URL in turn), including the logo. Files already on disk are skipped unless `--force` is passed. Entries that fail are marked `missing` in `data/asset-manifest.json`. The script then clears hero images, removes gallery rows, and strips content `<img>` tags and links that point at missing files, and records gallery image sizes.
7. Copy `.env.example` to `.env`, set `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, then `npm run seed:admin`.
8. Convert the design mocks:
   - Take colors, type scale, spacing, and radii from the mock's Tailwind config into `_tokens.scss`.
   - Rebuild sections as SCSS components with semantic class names. Do not ship the Tailwind CDN or utility class strings.
   - Do not ship mock placeholder images or mock brand names.
9. Run `npm run typecheck`, `npm run lint`, `npm run build`. All must pass with zero errors. Run `npm run media:check`; it must report the native sharp backend.
10. `npm run dev`, then in the browser: home, one page of each top-level section, a nested page, contact form (invalid and valid submit), admin login, a page edit, a home section edit, a menu edit. Check the logo on every page. On catalog sites also test: `/products`, a category with brand filter and page 2, a product (gallery, lightbox, enquiry form invalid and valid), `/brands` and one brand page, a few legacy URLs from `data/redirects.json` (expect 301 then 200), and in admin a product edit with an image upload (a `.webp` and `-thumb.webp` must appear) and image removal (both files must be deleted). Repeat the key pages at a 390px viewport and confirm there is no horizontal scroll.

## Catalog sites (products, categories, brands)

Use this when the legacy site is a product catalog: a `products` page whose children are categories, whose children are products, and a `PageType` column that marks each product's brand. Add a `catalog` block to `transform.config.json`:

| Key | Meaning |
| --- | --- |
| `productsRootKey` | Workbook page URL of the catalog root (its children become categories) |
| `brandPageTypes` | Map of workbook `PageType` value to brand name. Each entry becomes a brand; products with that `PageType` are linked to it |
| `brandLogoPattern` | Legacy path of brand logos, with `{slug}` |
| `sliderConfig` | Optional legacy slider config file (relative to `legacy.localRoot`) used for home hero slides |
| `slideImagePattern` | Legacy path of slide images, with `{image}` |

Add a `catalog` block to `content/seed.json`:

- `orphanCategory`: category slug for product rows whose parent page no longer exists.
- `draftCategories`: categories imported as drafts even when they have products.
- `categoryOrder`: category slugs in display order; categories not listed sort after these.
- `categoryOverrides.<slug>`: optional `name`, `summary`, and `icon` (a Material Symbols name).
- `brands.<slug>`: optional `name`, `summary`, `website`, and `featured` (shown in the home brand strip, default `true`).
- `featuredProducts`: product slugs flagged as featured on the home page.

What `npm run import:legacy` does on a catalog site:

- Pages outside the catalog root import as normal pages. Category and product rows write `data/categories.json`, `data/products.json`, and `data/brands.json`.
- Product specs come from `scripts/lib/product-specs.ts`. Short `Label: value` lines become rows in the product's `specs` list, and a `Model:` line fills `model`. The remaining HTML is tidied into the description. A product whose content was all specs has an empty description, which is expected.
- Two product rows in the same category with the same slug and the same text are imported once. The importer prints the skipped rows.
- Product slugs drop the legacy `_123` suffix and are made unique within their category.
- A category with no published products becomes a draft.
- Every legacy category and product URL is written to `data/redirects.json`, and the server answers it with a 301. Admin slug or category changes add new redirects automatically.

Public routes are `/products`, `/products/<category>`, `/products/<category>/<product>`, `/brands`, and `/brands/<brand>`. Category and brand listings have a brand or category filter and pagination (24 per page, with a canonical URL per page). The sitemap includes every published category, product, and brand. The product page enquiry form saves to Inquiries with the product attached.

## Media pipeline (all sites)

The rules are in `.cursor/rules/cms-media.mdc`. In short:

- Every image or file field in admin uses `admin/views/partials/media-picker.ejs`. The picker shows the current file, a live preview of the new choice, accept and size hints, a clear button, and Remove. Galleries use the `multiple` mode.
- Every raster image is converted to WebP by `imageProcessingService` and saved with a `-thumb.webp` sibling (400px). This covers admin uploads, editor uploads, `download:assets`, and the importer. The presets give the maximum box in pixels: `hero` 2000, `slide` 2000, `gallery` 1600, `content` 1600, `product` 1400, `social` 1200, `card` 800, `logo` 600, `thumb` 400. Images are never enlarged.
- Favicons are saved as 512px PNG. SVG is rejected. Uploads are checked by MIME type and by magic bytes.
- Width and height are stored with each image so views can set them.
- Replacing or removing an admin-uploaded file deletes it and its thumbnail. Imported files under `/uploads/legacy/` and the seeded `/uploads/site/logo.webp` are never deleted by admin actions.
- `sharp` is loaded lazily. If the native binary is missing, the site still boots and uploads return a 503 with a clear message. Tune with `SHARP_CONCURRENCY` (default 1) and `SHARP_CACHE_MB` (default 0).

To deploy on Ubuntu:

- Run `npm ci` on the server from the committed `package-lock.json`.
- Never copy `node_modules` from Windows. Never use `--omit=optional`.
- The lockfile must list `@img/sharp-linux-x64` and `@img/sharp-linux-arm64`.
- After `npm run build`, run `npm run media:check:prod`. Deployment is done only when it passes.

## Enhancement sequence

R&E Petroleum starts with `cmsSource` = `C:\ai\tests\btb\solu-new`.

After a site is merged:

1. Make CMS enhancements once, on the canonical CMS (the shared core above, in the latest finished site or a dedicated CMS repo).
2. Point `cmsSource` in this playbook's blank config, and in each pending site's config, at the enhanced tree.
3. Each later site starts from that tree, so it inherits the enhancements by reading the variable.
4. To bring an existing site up to date, merge the core layers only (`src/`, `admin/`, `scripts/`) and re-run `npm run cms:sync`. `views/`, `public/scss/_tokens.scss`, and `data/` are not replaced.

Do not recopy `solu-new` for later sites and do not paste enhancements into sites by hand.

## Known R&E Petroleum specifics (reference)

- 30 page rows; `contact-us-footer` feeds offices; home is composed from structured `data/home.json`.
- Logo: only the circular R&E mark from `https://www.re-petroleum.com/images/logo.png`.
- Tokens: primary `#69000a`, secondary `#775a19`, industrial gold `#B08D46`, container `1280px`, section gap `120px`, font Inter, icons Material Symbols.
- Dev port `3040`.
- `mechanical-contracting` has no content, children, or photos in the export, so it imports as a draft.
- The Agencies page uses in-page `#anchors`; the sanitizer keeps `id` on headings, links, `div`, and `span` for that reason.
- Procurement Operations used numbered bold paragraphs and `-` paragraphs; Agencies split one table in two and pointed several company links at the wrong domains. The legacy HTML normalizer fixes both.

## Known Throne Trading specifics (reference)

- Site folder `thronetrading/`, dev port `3042`. The workbook is `wwwroot/dbbackup.xls`, and `legacy.localRoot` is `wwwroot`. Remove both settings once `wwwroot` is deleted; assets already downloaded stay in `public/uploads/legacy/`.
- Catalog: 8 categories (`used-safes` is a draft), 144 products, and 7 brands from `PageType` 3 to 9. Product rows whose parent page is missing go to `home-and-offices`. There are 149 legacy redirects.
- Legacy page images are at `/PRV/Images/Pages/Page_{pageId}/{fileName}` (no `Large/` folder). Brand logos are at `/images/public/brands/{slug}.jpg`. Home slides come from `PRV/conf/Slider.config`.
- There is no footer office page (`footerPageKey` is `null`). The single office comes from the seed. The legacy site has no favicon, so it is left empty; set one under Admin > Site Settings.
- Logo: the blue THRONE TRADING S.A.R.L. wordmark (`images/throne-trading.png`). It has an opaque white background, so the footer shows it with an invert filter and `mix-blend-mode: screen`. Product, category, and brand images also have white backgrounds and use `mix-blend-mode: multiply` on tinted cards.
- Tokens: navy `#0b2540`, accent `#1d6fa5`, gold `#c9a14f`, deep navy `#08182a`. Fonts are Outfit for headings and Inter for body text. Icons are Material Symbols.
- Design snapshots (desktop at 1280px and mobile at 390px) for home, category, product, and brand pages are in `thronetrading/design/`.
