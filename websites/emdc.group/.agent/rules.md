# EMDC Website - Antigravity AI Assistant Rules

This document contains all the rules and conventions for the EMDC website project. These rules are authoritative and must be followed when making any code changes.

**Version:** 1.0  
**Last Updated:** 2025-12-20

---

## 1. Build Verification (CRITICAL)

- **After making any code changes (especially TypeScript files), ALWAYS run `npm run build` to verify the build succeeds**
- If build errors occur, fix them before completing the task
- This ensures TypeScript type checking and compilation errors are caught immediately
- Never commit code that doesn't build successfully

---

## 2. Project Architecture & Directory Layout

### MVC Pattern
- **Follow strict MVC separation**: 
  - All business logic in **services** (`src/services/`)
  - All presentation logic in **controllers** (`src/controllers/`)
  - All design and presentation in **views** (`views/` and `admin/views/`)

### Directory Structure
```
emdc-website/
├── src/                    # TypeScript runtime logic
│   ├── services/          # Business logic
│   ├── controllers/       # Request handlers
│   ├── constants/         # Constants including data-paths.ts
│   └── scripts/           # Build scripts (e.g., build-script.js)
├── admin/                 # Admin CMS application
│   ├── views/            # Admin EJS templates
│   ├── public/           # Admin static assets
│   │   ├── css/         # Admin styles
│   │   └── js/          # Admin scripts
│   ├── services/        # Admin business logic
│   ├── controllers/     # Admin controllers
│   └── routes/          # Admin routes
├── public/               # Frontend static assets
│   ├── css/             # Frontend SCSS/CSS
│   ├── js/              # Frontend JavaScript modules
│   └── images/          # Public images
├── data/                # JSON data stores
├── views/               # Public EJS templates
├── scripts/             # Automation & extraction scripts
├── readme/              # Documentation
├── tests/               # Automated & manual test helpers
└── docs/                # Project documentation
```

### Key Principles
- All JSON data under `data/` consumed via centralized path constants in `src/constants/data-paths.ts`
- Automation & extraction tasks live in `scripts/`; naming: `extract-*`, `replace-*`, `test-*` for clarity
- All readme files under `readme/` folder
- Put all tests in `tests/` directory
- Root-level `test-*.html` files are for ad hoc feature demos only (not served in production)

---

## 3. Naming Conventions

### Page Keys (CRITICAL)
- **Use kebab-case** (e.g., `who-we-are`)
- Page key is reused across:
  - JSON `pages.json` entry key
  - SCSS filename (`who-we-are.scss`)
  - Root HTML class (`<div class="inner-page who-we-are">`)
  - Menu link value

### Services & Controllers
- Services: `SomethingService.ts` (PascalCase with "Service" suffix)
- Controllers: `somethingController.ts` (camelCase with "Controller" suffix)

### Data Files
- JSON arrays/collections should be pluralized
- Maintain stable field names for backward compatibility

---

## 4. SCSS Structure & Compilation

### CRITICAL RULES
- **ALWAYS modify SCSS files** (`.scss`) for styling changes
- **NEVER directly edit compiled CSS files** (`styles.css`, `admin.css`)
- SCSS files are the source of truth; CSS files are generated

### File Structure

#### Frontend SCSS
```
public/css/
├── styles.scss              # Main entry point (imports all)
├── variables.scss           # Global variables
├── menu.scss               # Public fullscreen menu ONLY
├── header.scss             # Header styles
├── footer.scss             # Footer styles
├── home.scss               # Home page
├── inner-page.scss         # Base for all inner pages
├── projects.scss           # Projects page
├── contact.scss            # Contact page
├── dark-theme.scss         # Dark theme
└── pages/                  # Page-specific SCSS
    ├── inner-page.scss     # Generic inner page base
    ├── who-we-are.scss     # Specific page styles
    └── [page-key].scss     # Other page-specific files
```

#### Admin SCSS
```
admin/public/css/
├── admin.scss              # Admin entry point
└── custom.css             # Legacy admin styles (NOT for new menu styles)
```

### SCSS Best Practices
- **Nesting depth ≤ 3 levels**; refactor with flat BEM-style modifiers if deeper
- Use `&` for modifiers and pseudo-classes
- Inner page base: `.inner-page` (in `inner-page.scss`)
- Every inner page file root extends it (`@extend .inner-page`)
- Menu (public fullscreen) styles ONLY in `public/css/menu.scss`
- Admin feature styles belong in `admin/public/css/admin.scss`
- **Legacy `custom.css` is NOT for new menu styles**

### Style Encapsulation Classes
- `.menu-editing` - Admin menu management UI
- `.fullscreen-menu` - Public overlay menu
- `.enhanced-mask` - Optional advanced mask effects

### Compilation Commands
```bash
# Frontend (Public)
npm run scss           # Compressed (production)
npm run scss-dev       # Expanded (development)
npm run scss:once      # Compile once without watch

# Admin
npm run scss-admin     # Compressed (production)
npm run scss-admin-dev # Expanded (development)

# Both
npm run scss-all       # Compile both (compressed)
npm run scss-all-dev   # Compile both (expanded)
```

### Workflow
1. Make changes to `.scss` files
2. Compile SCSS to CSS using build tools
3. Test the compiled CSS output
4. Never commit uncompiled changes

---

## 5. Page Creation Workflow

### Step-by-Step Process
1. **Add to `data/pages.json`**: Add structured content & SEO (ensure unique key)
2. **Create SCSS file**: `public/css/pages/{page-key}.scss` with root selector `.{page-key}` extending `.inner-page`
3. **Import SCSS**: Add import in `styles.scss`
4. **Template structure**: Ensure EJS template outputs `<div class="inner-page {pageKey}">` wrapper
5. **Add to menu**: Update `data/menu.json` (or use CMS UI)
6. **Use semantic wrappers**: Use sectional wrappers (e.g., `.timeline-section`, `.values-section`)

### Page Template Structure
```html
<div class="inner-page <%= pageKey %>">
  <div class="inner-page-content">
    <div class="inner-page-box">
      <!-- Page content -->
    </div>
  </div>
</div>
```

### Page SCSS Structure
```scss
// pages/who-we-are.scss
@import '../variables';

.who-we-are {
  @extend .inner-page;  // Inherit base styles
  
  // Page-specific customizations
  .inner-page-content {
    .inner-page-box {
      // Custom styles for this page
    }
  }
}
```

### Background and Layout
- All inner pages use `background-gray.jpg` as background
- Width: 95% with max-width constraints
- Responsive design with breakpoints

---

## 6. JavaScript Modular Architecture

### File Structure
```
public/
├── js/                      # Individual modules for development
│   ├── menu.js             # Menu functionality
│   ├── worldmap.js         # World map functionality  
│   ├── fancybox-manager.js # Image gallery management
│   ├── parallax.js         # Parallax scroll effects
│   ├── slideshow.js        # WebGL slideshow
│   └── reveal-animation.js # Reveal animations
└── script.js               # Combined/built file for production
```

### Build Commands
```bash
npm run js:build    # Build once
node src/scripts/build-script.js --watch  # Watch mode
```

### Development Workflow
1. Edit individual files in `public/js/`
2. Build for production using `npm run js:build`
3. All global instances are pre-created and initialized
4. Legacy functions maintained for backward compatibility

### Available Classes
- `Menu` - Menu functionality
- `WorldMap` - Interactive world map
- `FancyboxManager` - Image gallery
- `Parallax` - Parallax effects

### Integration
For public site: all scripts must be in `public/js/` and compiled into `script.js` using `node src/scripts/build-script.js`

---

## 7. Menu Management System

### Data Files
- `data/menu.json` - Frontend menus
- `data/admin-menu.json` - Admin navigation

### Menu Item Schema
```json
{
  "id": "unique-id",
  "title": "Display Text",
  "type": "page|file|external",
  "link": "link-value",
  "sort": 1,
  "active": true,
  "children": []
}
```

### Key Features
- Drag & drop ordering via Sortable.js
- Hierarchy supported recursively
- UI always wrapped in `.menu-editing` for style scoping
- CRUD: `menuService.ts` + `menuController.ts` + routes in `admin/routes/index.ts`
- Maintain validation, error handling, singleton usage

### Link Types
1. **Page**: Internal pages using page keys
2. **File**: Downloadable files or documents
3. **External**: External websites or resources

### API Endpoints
- `GET /admin/menus` - List all menus
- `GET /admin/menus/create` - Show create form
- `POST /admin/menus/create` - Create new menu
- `GET /admin/menus/:id/edit` - Show edit form
- `POST /admin/menus/:id/edit` - Update menu
- `DELETE /admin/menus/:id` - Delete menu
- `POST /admin/menus/:menuId/items` - Add menu item
- `PUT /admin/menus/:menuId/items/:itemId` - Update item
- `DELETE /admin/menus/:menuId/items/:itemId` - Delete item
- `GET /admin/api/pages` - Get available pages

---

## 8. Image & Media Handling

### Upload Locations
- Generic uploads fallback: `public/images/generic` when no page key detected
- Page-specific: `public/images/{page-key}/`

### API Endpoints
- `POST /admin/api/upload-image` - Upload image
- `GET /admin/api/page-images?pageKey=...` - Get page images
- `GET /admin/api/public-images` - Get all public images

### Image Modal Logic
- Selection populates URL field only
- Explicit Insert/Update action required
- Editable via double-click inside editor
- Update mode pre-fills: URL, alt, class, width, height, align

---

## 9. Custom Editor Rules

### Key Principles
- Unified modal for insert & edit (deferred insertion pattern)
- Rich ↔ Source modes stay synchronized
- Updates must not break undo chain
- Future embeds follow same confirm-before-insert UX
- No automatic media insertion on click (always explicit Insert/Update action)

---

## 10. Enhanced Menu Background System

### Features
- Background image sync via slideshow callbacks (`window.slideshowInstance.addSlideChangeCallback`)
- Performance: slideshow paused while fullscreen menu active
- Throttled updates (≥300ms interval)
- Background opacity recommended range 0.05–0.25 (default 0.15)
- Rotation default 60s
- Enhanced mask toggled with `enableEnhancedMask()` / `disableEnhancedMask()`

---

## 11. Data Extraction & Regeneration

### Scripts
- `extract-project-photos.js` - Extract project photos
- `replace-pages-from-pptx.js` - Replace pages from PowerPoint
- `extract-pptx-site-settings.js` - Extract site settings
- Naming convention: `extract-<domain>-<descriptor>.js`

### Rules
- Regeneration must not silently remove existing fields
- Consider backup or diff logging
- `project-photos.json` structure: categorized map + `metadata` (counts must remain accurate)
- All extraction scripts should have timestamp logging

### Data Structure
```json
{
  "categories": {
    "Category Name": {
      "name": "Category Name",
      "slug": "category-slug",
      "projects": [...],
      "totalProjects": 8
    }
  },
  "metadata": {
    "totalCategories": 6,
    "totalProjects": 47,
    "extractedAt": "2025-07-22T23:27:12.519Z"
  }
}
```

---

## 12. Build & Runtime

### TypeScript Compilation
```bash
npm run build          # Compile TS (output to dist/)
npm run dev           # Dev server with hot reload
npm run prod          # Build and run production
npm run start         # Run compiled code
npm run dev:debug     # Dev with debugging
```

### Development Workflow
```bash
# Run both SCSS and JS in watch mode
npm run scss-dev &    # SCSS watch mode
npm run js:watch      # JS watch mode (if available)
```

### Important Notes
- Compile TS: `npm run build` (output `dist/`)
- Avoid committing generated CSS if reproducible
- Commit generated files only if deployment environment lacks build step

---

## 13. Testing & Validation

### Automated Testing
```bash
npm test              # Run Playwright tests
npm run test:ui       # Playwright UI mode
npm run test:headed   # Run tests with browser visible
npm run test:debug    # Debug mode
npm run test:report   # Show test report
npm run install:playwright  # Install Playwright browsers
```

### Test Organization
- Feature demo HTML allowed (naming `test-*-feature.html`)
- Not served in production routes
- Data validation scripts named `test-<domain>.js` under `scripts/`
- Use `tests/menu-css-test.html` to verify styles

---

## 14. Performance & UX Guidelines

### Best Practices
- Throttle heavy DOM updates
- Pause non-essential animations during overlays
- Preload only slideshow-critical assets
- Lazy-load other assets
- Keep animations subtle in content-critical contexts (e.g., menus) for readability

---

## 15. Security & Safety

### Rules
- Validate uploaded file type & sanitize filenames
- Reject remote URLs unless explicitly enabled
- Escape dynamic text in EJS unless sanitized HTML is intentional
- No external resource injection without justification
- Prefer local hosting for assets

---

## 16. Extensibility Principles

### Adding New Features
- New admin features: add service + controller + route
- Isolate persistence/business logic in services
- Always scope feature styles with a root encapsulation class to avoid cascade leakage
- Extend JSON schemas by additive fields
- Deprecate with transitional support

---

## 17. Prohibited Patterns (CRITICAL)

### NEVER DO THESE
1. ❌ No menu styles in `admin/public/css/custom.css`
2. ❌ No deep (>3) SCSS nesting; refactor with flat BEM-style modifiers
3. ❌ No automatic media insertion on click (always explicit Insert/Update action)
4. ❌ Avoid inline styles for reusable UI elements
5. ❌ Never directly edit compiled CSS files (`styles.css`, `admin.css`)
6. ❌ Never commit code that doesn't build successfully

---

## 18. Documentation Requirements

### When to Update Documentation
- Each substantive new feature: add `readme/<feature-name>.md`
- Document: purpose, data shape, API, and usage
- Update rule set when altering:
  - Page structure
  - Style architecture
  - Data schemas
  - Editor workflows
  - Build conventions

---

## 19. Assistant Automation Assumptions

### Expected Behaviors
- New page requests trigger scaffold: JSON stub, SCSS file + import, optional menu entry
- Menu additions auto-increment `sort` while ensuring unique `id` (prefer kebab-case)
- New extraction scripts follow `extract-<domain>-<descriptor>.js` naming with timestamp logging

---

## 20. Admin Structure

### CSS & JavaScript
- For admin: all CSS to be in `admin/public/css/custom.css` and all JS to be in `admin/public/js/custom.js`
- Exception: Menu-related styles go in `public/css/menu.scss`

---

## 21. Quick Reference Cheat Sheet

### Common Tasks
```bash
# Add new page
1. Add to data/pages.json
2. Create public/css/pages/{page-key}.scss
3. Import in styles.scss
4. Add to menu.json or use CMS UI

# Compile styles
npm run scss-dev        # Frontend (development)
npm run scss            # Frontend (production)
npm run scss-admin-dev  # Admin (development)
npm run scss-admin      # Admin (production)

# Build TypeScript
npm run build           # Compile TS
npm run dev            # Run dev server

# Build JavaScript
npm run js:build        # Build frontend JS modules

# Regenerate data
node scripts/extract-project-photos.js

# Run tests
npm test               # Run all tests
```

---

## 22. Future Hooks (Reserved Enhancements)

### Planned Features
- **Menu**: analytics, caching, i18n, bulk ops, templates
- **Media**: optimization, tagging, search, bulk operations
- **Visual**: additional mask patterns, admin-configurable opacity & timing

---

## 23. Change Control

### Version Management
- Increment version when modifying rules
- Summarize changes in CHANGELOG section
- Breaking changes require:
  1. Documentation update
  2. Migration note
  3. Optional helper script

---

## 24. Technology Stack

### Core Technologies
- **Backend**: Node.js + Express + TypeScript
- **Templating**: EJS (Embedded JavaScript)
- **Styling**: SCSS (Sass)
- **Frontend JS**: Modular JavaScript (compiled to single file)
- **Database**: JSON files (file-based CMS)
- **Testing**: Playwright
- **Build Tools**: TypeScript Compiler, node-sass

### Key Dependencies
- `express` - Web framework
- `express-session` - Session management
- `multer` - File uploads
- `node-sass` - SCSS compilation
- `typescript` - Type safety
- `@playwright/test` - E2E testing
- `ejs` - Templating
- `adm-zip` - ZIP file handling
- `mammoth` - Word document processing
- `tesseract.js` - OCR functionality

---

## Summary

This is a TypeScript-based Node.js CMS project with:
- Strict MVC architecture
- SCSS-based styling with modular structure
- Modular JavaScript architecture
- JSON-based data storage
- Comprehensive menu management system
- Build verification requirements
- Clear separation between admin and public interfaces

**Always run `npm run build` after making changes to verify everything compiles correctly!**
