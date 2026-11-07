# Legacy site transformation playbook

This playbook turns a legacy site of the "re-petroleum" family into a Node.js CMS site with a new design. Five more sites share the same legacy shape. Their designs differ; this pipeline does not.

The first site built with it is R&E Petroleum (`site/` in this repo). Use it as the reference implementation.

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
| `legacy` | Image path pattern, footer page key, contact page key, uploads mirror prefix |
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
- Admin modules: login, users, profile, dashboard, pages (with gallery), home sections, menus, site settings, offices, inquiries, image upload and the rich-text editor APIs.
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
9. Run `npm run typecheck`, `npm run lint`, `npm run build`. All must pass with zero errors.
10. `npm run dev`, then in the browser: home, one page of each top-level section, a nested page, contact form (invalid and valid submit), admin login, a page edit, a home section edit, a menu edit. Check the logo on every page.

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
