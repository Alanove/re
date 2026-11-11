# EMDC Project Rule Set (v1.0)

Authoritative conventions and operational guidelines for this repository. All future changes must update this file (with version bump) when altering core rules.

## 1. Architecture & Directory Layout
- MVC-inspired separation: `src/` (TS runtime logic), `admin/` (admin CMS app), `public/` (frontend static assets), `data/` (JSON stores), `views/` & `admin/views/` (EJS templates), `scripts/` (automation / extraction), `readme/` (documentation), `tests/` (automated & manual test helpers), root-level `test-*.html` (ad hoc feature demos only).
- All JSON data under `data/` consumed via centralized path constants in `src/constants/data-paths.ts`.
- Automation & extraction tasks live in `scripts/`; naming: `extract-*`, `replace-*`, `test-*` for clarity.

## 2. Naming Conventions
- Page key: kebab-case (e.g. `who-we-are`) reused across: JSON `pages.json` entry key, SCSS filename (`who-we-are.scss`), root HTML class (`<div class="inner-page who-we-are">`), menu link value.
- Services: `SomethingService.ts`; Controllers: `somethingController.ts`.
- Data JSON arrays/collections pluralized; stable field names maintained for backward compatibility.

## 3. SCSS Structure & Compilation
- Frontend entry: `public/css/styles.scss`; Admin entry: `admin/public/css/admin.scss`.
- Page-specific SCSS: `public/css/pages/{page-key}.scss` (imported into `styles.scss`).
- Global variables: `public/css/variables.scss` (or `_variables.scss` if refactored—must be consistent).
- Inner page base: `.inner-page` (in `inner-page.scss`); every inner page file root extends it (`@extend .inner-page`).
- Menu (public fullscreen) styles ONLY in `public/css/menu.scss`.
- Admin feature styles belong in `admin/public/css/admin.scss`; legacy `custom.css` is not for new menu styles.
- Encapsulation classes: `.menu-editing` (admin menu management UI), `.fullscreen-menu` (public overlay), `.enhanced-mask` (optional advanced mask effects).
- Nesting depth ≤ 3 levels; use `&` for modifiers and pseudo-classes.

## 4. Page Creation Workflow
1. Add structured content & SEO to `data/pages.json` (ensure unique key).
2. Create `public/css/pages/{page-key}.scss` with root selector `.{page-key}` extending `.inner-page`.
3. Import SCSS in `styles.scss`.
4. Ensure EJS template outputs `<div class="inner-page {pageKey}">` wrapper.
5. Add to menu via `data/menu.json` (or CMS UI).
6. Use semantic sectional wrappers (e.g. `.timeline-section`, `.values-section`).

## 5. Menu Management System
- Data: `data/menu.json` (frontend menus), `data/admin-menu.json` (admin navigation).
- Item schema: `{ id, title, type(page|file|external), link, sort, active, children[] }`.
- Drag & drop ordering via Sortable.js; hierarchy supported recursively.
- UI always wrapped in `.menu-editing` for style scoping.
- CRUD: `menuService.ts` + `menuController.ts` + routes in `admin/routes/index.ts`.
- Maintain validation, error handling, singleton usage.

## 6. Image & Media Handling
- Generic uploads fallback: `public/images/generic` when no page key is detected.
- API endpoints: `POST /admin/api/upload-image`, `GET /admin/api/page-images?pageKey=...`, `GET /admin/api/public-images`.
- Image modal logic: selection populates URL field only; explicit Insert/Update action required.
- Editable via double-click inside editor (`Update` mode pre-fills fields: URL, alt, class, width, height, align).

## 7. Custom Editor Rules
- Unified modal for insert & edit (deferred insertion pattern).
- Rich ↔ Source modes stay synchronized; updates must not break undo chain.
- Future embeds follow same confirm-before-insert UX.

## 8. Enhanced Menu Background System
- Background image sync via slideshow callbacks (`window.slideshowInstance.addSlideChangeCallback`).
- Performance: slideshow paused while fullscreen menu active; throttled updates (≥300ms interval).
- Background opacity recommended range 0.05–0.25 (default 0.15); rotation default 60s.
- Enhanced mask toggled with `enableEnhancedMask()` / `disableEnhancedMask()`.

## 9. Data Extraction & Regeneration
- Scripts regenerate JSON: `extract-project-photos.js`, `replace-pages-from-pptx.js`, `extract-pptx-site-settings.js`, etc.
- Regeneration must not silently remove existing fields—consider backup or diff logging.
- `project-photos.json` structure: categorized map + `metadata` (counts must remain accurate).

## 10. Build & Runtime
- Compile TS: `npm run build` (output `dist/`).
- Dev server (hot reload): `npm run dev`.
- SCSS commands: public (`scss` / `scss-dev`), admin (`scss-admin` / `scss-admin-dev`), combined (`scss-all` / `scss-all-dev`).
- Avoid committing generated CSS if reproducible; commit only if deployment environment lacks build step.

## 11. Testing & Validation
- Automated: Playwright via `npm test`.
- Feature demo HTML allowed (naming `test-*-feature.html`)—not served in production routes.
- Data validation scripts named `test-<domain>.js` under `scripts/` for quick integrity checks.

## 12. Performance & UX Guidelines
- Throttle heavy DOM updates; pause non-essential animations during overlays.
- Preload only slideshow-critical assets; lazy-load others.
- Keep animations subtle in content-critical contexts (e.g. menus) for readability.

## 13. Security & Safety
- Validate uploaded file type & sanitize filenames; reject remote URLs unless explicitly enabled.
- Escape dynamic text in EJS unless sanitized HTML is intentional.
- No external resource injection without justification; prefer local hosting.

## 14. Extensibility Principles
- New admin features: add service + controller + route; isolate persistence/business logic in services.
- Always scope feature styles with a root encapsulation class to avoid cascade leakage.
- Extend JSON schemas by additive fields; deprecate with transitional support.

## 15. Prohibited Patterns
- No menu styles in `admin/public/css/custom.css`.
- No deep (>3) SCSS nesting; refactor with flat BEM-style modifiers.
- No automatic media insertion on click (always explicit Insert/Update action).
- Avoid inline styles for reusable UI elements.

## 16. Documentation Requirements
- Each substantive new feature: add `readme/<feature-name>.md` documenting purpose, data shape, API, and usage.
- Update this rule set when altering: page structure, style architecture, data schemas, editor workflows, build conventions.

## 17. Assistant Automation Assumptions
- New page requests will trigger scaffold: JSON stub, SCSS file + import, optional menu entry.
- Menu additions auto-increment `sort` while ensuring unique `id` (prefer kebab-case).
- New extraction scripts follow `extract-<domain>-<descriptor>.js` naming with timestamp logging.

## 18. Future Hooks (Reserved Enhancements)
- Menu: analytics, caching, i18n, bulk ops, templates.
- Media: optimization, tagging, search, bulk operations.
- Visual: additional mask patterns, admin-configurable opacity & timing.

## 19. Change Control
- Increment version at top (`vX.Y`) when modifying rules; summarize changes in a short CHANGELOG section appended here.
- Breaking changes require: (1) doc update, (2) migration note, (3) optional helper script.

## 20. Quick Reference (Cheat Sheet)
- Add page: JSON + SCSS + import + menu.
- Add menu item: update `menu.json` (keep `sort`) or use CMS UI.
- Compile styles (frontend): `npm run scss-dev` (dev) / `npm run scss` (prod).
- Compile styles (admin): `npm run scss-admin-dev` / `npm run scss-admin`.
- Build TS: `npm run build`; Run dev: `npm run dev`.
- Regenerate project photos: `node scripts/extract-project-photos.js`.

---
Last updated: 2025-08-12
