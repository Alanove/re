# EMDC Website - Quick Reference Guide

## 🚀 Most Common Commands

### Build & Run
```bash
npm run build          # ⚠️ ALWAYS run after TypeScript changes
npm run dev           # Start development server
npm run prod          # Build and run production
```

### SCSS Compilation
```bash
npm run scss-dev       # Frontend styles (watch mode)
npm run scss-admin-dev # Admin styles (watch mode)
npm run scss-all-dev   # Both (watch mode)
```

### JavaScript Build
```bash
npm run js:build       # Build frontend JS modules
```

### Testing
```bash
npm test              # Run all Playwright tests
npm run test:ui       # Interactive test UI
```

## 📁 Key File Locations

### Data Files
- `data/pages.json` - Page content and SEO
- `data/menu.json` - Frontend menus
- `data/admin-menu.json` - Admin navigation
- `data/site-settings.json` - Global settings
- `data/projects.json` - Project portfolio
- `data/project-photos.json` - Project images

### Styles
- `public/css/styles.scss` - Frontend main entry
- `public/css/pages/` - Page-specific SCSS
- `admin/public/css/admin.scss` - Admin main entry

### JavaScript
- `public/js/` - Frontend JS modules
- `public/script.js` - Compiled frontend JS
- `admin/public/js/custom.js` - Admin JS

### Services & Controllers
- `src/services/` - Business logic
- `src/controllers/` - Request handlers
- `admin/services/` - Admin business logic
- `admin/controllers/` - Admin controllers

## 🎯 Common Tasks

### Add a New Page
1. Add entry to `data/pages.json` with unique kebab-case key
2. Create `public/css/pages/{page-key}.scss`
3. Import in `public/css/styles.scss`
4. Add to menu via `data/menu.json` or CMS
5. Run `npm run scss-dev` to compile
6. Run `npm run build` to verify

### Add New Styles
1. Edit appropriate `.scss` file (NEVER edit `.css` directly)
2. Run `npm run scss-dev` or `npm run scss-admin-dev`
3. Test in browser
4. Run `npm run build` to verify no TS errors

### Add Menu Item
1. Go to Admin Panel → Menus
2. Edit desired menu
3. Fill in form: Title, Type, Link, Sort Order
4. Click "Add Item"
5. Drag to reorder if needed

### Upload Images
1. Use Admin Panel upload feature
2. Images go to `public/images/{page-key}/` or `public/images/generic/`
3. Select in editor modal
4. Click Insert/Update

## ⚠️ Critical Rules

### ALWAYS
- ✅ Run `npm run build` after TypeScript changes
- ✅ Edit `.scss` files, not `.css` files
- ✅ Use kebab-case for page keys
- ✅ Follow MVC pattern (services → controllers → views)
- ✅ Test changes before committing

### NEVER
- ❌ Edit compiled CSS files (`styles.css`, `admin.css`)
- ❌ Add menu styles to `admin/public/css/custom.css`
- ❌ Nest SCSS more than 3 levels deep
- ❌ Commit code that doesn't build
- ❌ Auto-insert media on click (require explicit action)

## 🏗️ Architecture Quick View

```
Request → Route → Controller → Service → Data (JSON)
                      ↓
                    View (EJS) → Browser
```

### MVC Separation
- **Model**: JSON files in `data/`
- **View**: EJS templates in `views/` and `admin/views/`
- **Controller**: Request handlers in `src/controllers/` and `admin/controllers/`
- **Service**: Business logic in `src/services/` and `admin/services/`

## 🎨 SCSS Structure

```
styles.scss (main entry)
├── variables.scss
├── header.scss
├── footer.scss
├── menu.scss (public menu ONLY)
├── home.scss
├── inner-page.scss
├── projects.scss
└── pages/
    ├── inner-page.scss (base)
    ├── who-we-are.scss
    └── {page-key}.scss
```

### Page SCSS Template
```scss
@import '../variables';

.{page-key} {
  @extend .inner-page;
  
  // Page-specific styles
}
```

## 📝 Naming Conventions

- **Page Keys**: `kebab-case` (e.g., `who-we-are`)
- **Services**: `SomethingService.ts`
- **Controllers**: `somethingController.ts`
- **Scripts**: `extract-*.js`, `test-*.js`, `replace-*.js`
- **CSS Classes**: Match page key (`.who-we-are`)

## 🔧 Troubleshooting

### Build Fails
1. Check TypeScript errors in console
2. Verify all imports exist
3. Check for syntax errors
4. Run `npm run build` to see full error

### Styles Not Applying
1. Did you compile SCSS? Run `npm run scss-dev`
2. Check browser console for CSS errors
3. Verify correct class names
4. Clear browser cache

### Menu Not Working
1. Check `data/menu.json` syntax
2. Verify Sortable.js is loaded
3. Check browser console for errors
4. Ensure `.menu-editing` wrapper exists (for admin)

## 📚 Documentation

- **Full Rules**: `.agent/rules.md`
- **Project Rules**: `readme/project-rules.md`
- **Page Structure**: `readme/page-structure-rules.md`
- **SCSS Rules**: `readme/scss-styling-rules.md`
- **JavaScript**: `readme/javascript-modules.md`
- **Menu System**: `readme/menu-management.md`

## 🎓 Learning Path

1. Read `.agent/rules.md` for comprehensive overview
2. Review `readme/project-rules.md` for detailed conventions
3. Check specific `readme/*.md` files for feature documentation
4. Explore `data/` files to understand data structure
5. Review `src/services/` to understand business logic

---

**Remember**: When in doubt, run `npm run build` to verify everything works!
