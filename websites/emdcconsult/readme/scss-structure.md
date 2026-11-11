# SCSS Structure and Compilation

This document explains the SCSS structure and how to compile styles for the EMDC website project.

## Overview

The project uses SCSS (Sass) for styling with a modular approach. All styles are compiled into CSS files that are served to the browser.

## File Structure

### Public SCSS Files (Frontend)
- `public/css/styles.scss` - Main SCSS file that imports all other SCSS files
- `public/css/variables.scss` - Global SCSS variables
- `public/css/header.scss` - Header styles
- `public/css/menu.scss` - Public menu styles
- `public/css/footer.scss` - Footer styles
- `public/css/home.scss` - Home page styles
- `public/css/inner-page.scss` - Inner page styles
- `public/css/dark-theme.scss` - Dark theme styles
- `public/css/projects.scss` - Projects page styles
- `public/css/contact.scss` - Contact page styles

### Admin SCSS Files (Admin Panel)
- `admin/public/css/admin.scss` - Admin panel specific styles (including menu management)
- `admin/public/css/custom.css` - Legacy admin styles (not compiled)

## Compilation

### Available Scripts

```bash
# Compile public SCSS (compressed)
npm run scss

# Compile public SCSS (expanded, for development)
npm run scss-dev

# Compile admin SCSS (compressed)
npm run scss-admin

# Compile admin SCSS (expanded, for development)
npm run scss-admin-dev

# Compile both public and admin SCSS
npm run scss-all

# Compile both public and admin SCSS (expanded)
npm run scss-all-dev
```

## Style Encapsulation

### Menu Management Styles
All menu management styles are encapsulated within the `.menu-editing` container class to prevent conflicts with existing admin styles. This includes:

- Menu item styling (`.menu-item`, `.menu-item-content`, etc.)
- Sortable.js drag-and-drop styles
- Menu statistics cards
- Menu forms and previews
- Responsive design for menu management

### Usage
To use menu management styles, wrap your content with the `.menu-editing` class:

```html
<div class="menu-editing">
    <!-- Menu management content here -->
    <div class="menu-item">
        <!-- Menu item content -->
    </div>
</div>
```

## How to Add New Styles

### For Public Pages
1. Create a new SCSS file in `public/css/` (e.g., `new-page.scss`)
2. Add your styles to the file
3. Import it in `public/css/styles.scss`:
   ```scss
   @import 'new-page';
   ```
4. Compile using `npm run scss`

### For Admin Panel
1. Add your styles to `admin/public/css/admin.scss`
2. If the styles are specific to a feature, consider encapsulating them in a container class
3. Compile using `npm run scss-admin`

## SCSS Features Used

### Variables
```scss
$primary-color: #007bff;
$secondary-color: #6c757d;
```

### Nesting
```scss
.menu-item {
  border: 1px solid #ddd;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .menu-item-content {
    display: flex;
  }
}
```

### Mixins (if needed)
```scss
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## Available CSS Classes

### Menu Management (within .menu-editing)
- `.menu-item` - Individual menu item container
- `.menu-item-content` - Menu item content wrapper
- `.menu-item-handle` - Drag handle for reordering
- `.menu-item-info` - Menu item information area
- `.menu-item-title` - Menu item title
- `.menu-item-details` - Menu item details (type, link)
- `.menu-item-actions` - Action buttons (edit, delete)
- `.menu-item-children` - Container for child menu items
- `.menu-stats-card` - Statistics card styling
- `.menu-form` - Menu form styling
- `.menu-preview` - Menu preview area

### Sortable.js Classes
- `.sortable-ghost` - Ghost element during drag
- `.sortable-chosen` - Selected element during drag
- `.sortable-drag` - Element being dragged

## Responsive Design

The menu management styles include responsive design for mobile devices:

```scss
@media (max-width: 768px) {
  .menu-item-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
```

## Troubleshooting

### Styles Not Applying
1. Make sure the SCSS is compiled: `npm run scss-admin`
2. Check that the CSS file is linked in the HTML
3. Verify the styles are within the correct container class (`.menu-editing` for menu styles)

### Conflicts with Existing Styles
- All menu management styles are encapsulated in `.menu-editing`
- If conflicts occur, check for specificity issues
- Consider using more specific selectors or `!important` (as a last resort)

### Compilation Errors
1. Check SCSS syntax
2. Verify all imports exist
3. Ensure proper nesting and closing braces

## Development Workflow

1. **Development**: Use `npm run scss-admin-dev` for expanded CSS (easier to debug)
2. **Production**: Use `npm run scss-admin` for compressed CSS
3. **Testing**: Use the test HTML file (`tests/menu-css-test.html`) to verify styles
4. **Documentation**: Update this file when adding new styles or changing structure

## File History

- **Removed**: `public/css/admin-menu.scss` - Redundant file, content moved to `admin/public/css/admin.scss`
- **Updated**: `public/css/styles.scss` - Removed import of `admin-menu.scss`
- **Enhanced**: `admin/public/css/admin.scss` - Added style encapsulation with `.menu-editing` container
- **Updated**: All menu EJS templates - Wrapped content with `.menu-editing` container
