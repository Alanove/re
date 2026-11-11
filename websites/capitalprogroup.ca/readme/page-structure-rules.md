# Page Structure Rules

This document outlines the rules and organization for page styling in the EMDC website project.

## Directory Structure

```
public/css/
├── pages/                    # Page-specific SCSS files
│   ├── inner-page.scss      # Generic styles for all inner pages
│   ├── who-we-are.scss      # Specific styles for "Who We Are" page
│   └── [page-name].scss     # Additional page-specific files
├── styles.scss              # Main styles file (imports all pages)
└── variables.scss           # Global variables
```

## Rules

### 1. Page-Specific SCSS Files
- Each page should have its own SCSS file located under `css/pages/page-name.scss`
- The file name should match the page key (e.g., `who-we-are.scss` for the "who-we-are" page)
- All page-specific files must be imported in `styles.scss`

### 2. CSS Class Naming Convention
- Each page should have a CSS class that matches its page key
- Example: "Who We Are" page has class `who-we-are`
- The main parent element selector in the page SCSS should be the page key class

### 3. Generic Inner Page Styles
- `inner-page.scss` contains common styles for all inner pages
- Includes background image (`background-gray.jpg`) for all inner pages
- Provides full-width layout and responsive design
- All page-specific styles should extend from `.inner-page`

### 4. Page Template Structure
- The page template (`views/page.ejs`) uses the structure:
  ```html
  <div class="inner-page <%= pageKey %>">
    <div class="inner-page-content">
      <div class="inner-page-box">
        <!-- Page content -->
      </div>
    </div>
  </div>
  ```

### 5. Background and Layout
- All inner pages use `background-gray.jpg` as the background image
- Width is set to almost full width (95% with max-width constraints)
- Responsive design with breakpoints for different screen sizes

## Implementation Example

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

### Page Content Structure
```html
<div class="company-highlights">
  <div class="highlight-item">
    <h3>🏗️ Engineering Excellence</h3>
    <p>Content...</p>
  </div>
</div>

<div class="timeline-section">
  <div class="timeline-item">
    <div class="year">2008</div>
    <div class="description">Content...</div>
  </div>
</div>

<div class="values-section">
  <div class="value-item">
    <div class="value-icon">🌱</div>
    <div class="value-title">Title</div>
    <div class="value-description">Description...</div>
  </div>
</div>
```

## Adding New Pages

1. Create a new SCSS file in `public/css/pages/` with the page key as the filename
2. Use the page key as the main CSS class selector
3. Extend from `.inner-page` for base styles
4. Add page-specific customizations
5. Import the new file in `styles.scss`
6. Update the page content in `data/pages.json` to use appropriate CSS classes

## Current Pages

- **Who We Are** (`who-we-are.scss`)
  - Company highlights section
  - Timeline/journey section
  - Values section
  - Call-to-action section

## Testing

Use the test file `test-page-structure.html` to verify that the CSS structure works correctly before implementing in the main application.
