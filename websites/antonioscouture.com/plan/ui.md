# Modernize Home Page Design with Bootstrap 5

## Overview

Recreate the home page design from `old/index.html` using Bootstrap 5, modernizing the design while preserving the aesthetic. Integrate with existing menu system and ensure full responsiveness.

---

## Implementation Status

### ✅ Completed
- Bootstrap 5.3.2 CDN integration in `views/layout.ejs`
- Bootstrap Icons integration
- SCSS structure created (`public/css/styles.scss` and `public/css/_variables.scss`)
- Header navigation modernized with Bootstrap 5 navbar (`views/partials/header.ejs`)
- Home page template modernized (`views/index.ejs`)
- Fullscreen menu system (`views/partials/menu.ejs`)
- Bootstrap 5 JS bundle with Popper.js included

### ✅ Recently Completed
- ✅ Modern JavaScript file created (`public/js/script.js`) - No Mootools dependencies
- ✅ Smooth scrolling functionality implemented
- ✅ Fullscreen menu JavaScript interactions complete
- ✅ Scroll animations with IntersectionObserver API
- ✅ Mobile menu enhancements
- ✅ SCSS compiled to CSS
- ✅ Fullscreen menu CSS styles added
- ✅ Page loader functionality
- ✅ Responsive utilities (`.mobilehide`, `.mobileshow`)

### 🟡 In Progress
- Responsive design testing across all breakpoints
- Image assets verification and optimization

### ❓ Pending Verification
- Gallery images integration
- Background images for banner sections
- Icons/decoration images (`.additional_1`, `.additional_2`)
- Cross-browser compatibility testing

---

## Analysis

### Old HTML Structure

- **Header**: Logo area with top banner image (`images/top.png`)
- **Navigation**: Horizontal menu (will use existing menu system from `res.locals.items`)
- **Region 1**: Banner section with background image/text overlay
- **Region 2**: Quick navigation buttons (Расписание богослужений, Новости, Объявления)
- **Region 3**: Empty content area
- **Region 4**: Three-column layout:
- Left: "Найти нас" (Find Us) section
- Center: "НАША Галерея" (Our Gallery) with photos div
- Right: "О нас" (About Us) section
- **Region 12**: Video button section
- **Footer**: Stats and analytics

### Current System Integration

- ✅ Menu system: `res.locals.items` already populated via `pagesService.getMenuItems()`
- ✅ Layout system: Uses `layout.ejs` with header/footer partials
- ✅ Menu partials: `partials/header.ejs` and `partials/menu.ejs` exist
- ✅ Home controller: `src/controllers/homeController.ts` provides slides and data

### Images Identified

- ✅ `top.png` - exists in `public/images/`
- ❓ Background images for banner section (`.frontpagebanner`, `.frontpageimage`)
- ❓ Gallery images (`.photos` div) - default placeholder exists
- ❓ Icons/decoration images (`.additional_1`, `.additional_2`)
- ❓ Slideshow images (handled via SliderService)

---

## Implementation Plan

### 1. ✅ Upgrade Bootstrap to Latest (v5.3.x) - **COMPLETED**

**Status**: ✅ Complete

**Files Modified**:
- `views/layout.ejs` - Bootstrap 5.3.2 CDN integrated (line 50)
- Bootstrap Icons 1.11.3 CDN integrated (line 53)
- Bootstrap 5.3 JS bundle with Popper.js included (line 118)

**Migration Completed**:
- `.row-fluid` → `.row` with Bootstrap 5 grid
- `.span*` → `.col-*` or `.col-md-*`
- Button classes updated to Bootstrap 5
- Navbar rewritten using Bootstrap 5 navbar component
- Bootstrap 5 utility classes implemented

---

### 2. ✅ Create Modern SCSS Structure - **COMPLETED**

**Status**: ✅ Complete

**Files Created**:
- ✅ `public/css/styles.scss` - Main stylesheet with component styles
- ✅ `public/css/_variables.scss` - Custom SCSS variables extending Bootstrap 5

**Features Implemented**:
- Custom color variables matching original design aesthetic (#8B2635 primary color)
- Typography variables (fonts, sizes, line-heights)
- Spacing utilities and grid configuration
- Component styles:
  - ✅ Header/navigation with responsive mobile menu
  - ✅ Banner sections
  - ✅ Button styles (booking buttons, etc.)
  - ✅ Gallery section
  - ✅ Module cards
- Responsive utilities for all sections

**Note**: Bootstrap 5 CSS loaded via CDN, custom SCSS extends and customizes Bootstrap components.

---

### 3. ✅ Update Header/Navigation - **COMPLETED**

**Status**: ✅ Complete

**Files Modified**:
- ✅ `views/partials/header.ejs` - Bootstrap 5 navbar component

**Features Implemented**:
- ✅ Bootstrap 5 navbar with responsive collapse menu
- ✅ Dynamic menu from `res.locals.items`
- ✅ Top banner image (`top.png`) display
- ✅ Logo display maintained
- ✅ Mobile menu uses Bootstrap 5 collapse functionality
- ✅ Dropdown menus for nested items
- ✅ Active state handling

**Additional Menu System**:
- ✅ Fullscreen menu component (`views/partials/menu.ejs`)
- ✅ Custom burger menu implementation

---

### 4. ✅ Create Modernized Home Page Template - **COMPLETED**

**Status**: ✅ Complete

**Files Modified**:
- ✅ `views/index.ejs` - Modernized home page template

**Features Implemented**:
- ✅ Bootstrap 5 grid system (`.container`, `.row`, `.col-*`)
- ✅ Semantic HTML5 elements (`<section>` tags)
- ✅ Banner section with modern CSS (background-image, overlay)
- ✅ Quick navigation cards/buttons using Bootstrap 5 components
- ✅ Three-column section with Bootstrap 5 grid:
  - Left: "Найти нас" (Find Us) - Contact information
  - Center: "НАША Галерея" (Our Gallery) - Photo gallery link
  - Right: "О нас" (About Us) - About page link
- ✅ Video section button
- ✅ Responsive grid classes (`col-lg-*`, `col-md-*`)
- ✅ Integration with SliderService for banner slides

**Content Mapping**:
- Banner images from `sliderService.getActiveSlides()`
- Menu items from `res.locals.items`
- Gallery placeholder with link to `/photo-gallery`
- Contact page link to `/contacts`
- About page link to `/o-nas`

---

### 5. 🟡 Responsive Design Implementation - **IN PROGRESS**

**Status**: 🟡 Needs Testing

**Implemented**:
- ✅ Mobile-first approach using Bootstrap 5 breakpoints
- ✅ Responsive grid classes (`col-lg-*`, `col-md-*`, `col-*`)
- ✅ Responsive utilities in SCSS
- ✅ Mobile-specific classes (`.mobilehide`, `.mobileshow`)
- ✅ Touch-friendly navigation with Bootstrap collapse

**Testing Required**:
- ⚠️ Test at all breakpoints: xs, sm, md, lg, xl, xxl
- ⚠️ Verify responsive typography scaling
- ⚠️ Test flexible images and media
- ⚠️ Verify touch interactions on mobile devices
- ⚠️ Cross-device testing (tablets, phones, desktops)

---

### 6. ✅ Modern JavaScript - **COMPLETED**

**Status**: ✅ Complete

**Completed**:
- ✅ Bootstrap 5 JS bundle includes Popper.js (no separate dependency needed)
- ✅ jQuery 3.7.1 included for compatibility
- ✅ Custom script file (`public/js/script.js`) created with modern JavaScript
- ✅ No Mootools dependencies - completely removed
- ✅ Smooth scrolling implemented for anchor links
- ✅ Modern scroll animations using IntersectionObserver API
- ✅ Fullscreen menu JavaScript interactions
- ✅ Mobile menu enhancements
- ✅ Page loader functionality
- ✅ Responsive window resize handling

**Files Created/Modified**:
- ✅ `public/js/script.js` - Modern JavaScript file with all functionality

---

## Files Status

### Created Files
1. ✅ **`public/css/styles.scss`** - Main stylesheet (EXISTS)
2. ✅ **`public/css/_variables.scss`** - SCSS variables (EXISTS)

### Modified Files
1. ✅ **`views/layout.ejs`** - Bootstrap 5 CDN, modern dependencies (UPDATED)
2. ✅ **`views/index.ejs`** - Home page template with Bootstrap 5 (UPDATED)
3. ✅ **`views/partials/header.ejs`** - Bootstrap 5 navbar with dynamic menu + fullscreen menu toggle (UPDATED)
4. ✅ **`views/partials/menu.ejs`** - Fullscreen menu system (EXISTS)
5. ✅ **`public/css/styles.scss`** - Added fullscreen menu styles, loader styles, responsive utilities (UPDATED)
6. ✅ **`public/css/styles.css`** - Compiled CSS file (COMPILED)
7. ✅ **`public/js/script.js`** - Modern JavaScript with all interactions (CREATED)

### Files Requiring Review
1. ✅ **`public/js/script.js`** - ✅ Verified - No Mootools dependencies (created from scratch)
2. ❓ **Image assets** - Verify all required images exist in `public/images/`

---

## Bootstrap 5 Migration Reference

### Grid System
- `.container-fluid` → `.container-fluid` (unchanged)
- `.row` → `.row` (unchanged)
- `.span*` → `.col-*` or `.col-md-*` (updated)
- Grid now uses 12-column system by default

### Components
- **Buttons**: `.btn` classes remain similar, structure updated
- **Navbar**: Complete rewrite using Bootstrap 5 navbar component
- **Cards**: Use `.card`, `.card-body`, `.card-header` classes
- **Utilities**: Use Bootstrap 5 utility classes (spacing, display, flexbox, etc.)

### JavaScript
- Bootstrap 5 JS bundle includes Popper.js (no separate dependency)
- Event names updated (e.g., `shown.bs.collapse` instead of `shown.bs.modal`)
- Data attributes updated (e.g., `data-bs-toggle` instead of `data-toggle`)

---

## Design Modernization

### Implemented
- ✅ Preserved color scheme and general layout aesthetic
- ✅ Improved spacing and visual hierarchy
- ✅ Added subtle shadows and modern effects
- ✅ Smooth transitions and hover states
- ✅ Better contrast and accessibility
- ✅ Modern card designs for content sections

### Typography
- ⚠️ Currently using Arial/Helvetica (consider modern web fonts)
- ✅ Typography variables defined in `_variables.scss`
- ✅ Responsive font sizes using Bootstrap utilities

**Recommendation**: Consider adding Google Fonts or custom web fonts for improved typography.

---

## Testing Checklist

### Functionality Testing
- [ ] Home page loads correctly
- [ ] Navigation menu works on all devices
- [ ] Dropdown menus function properly
- [ ] All links navigate correctly
- [ ] Banner slider displays properly
- [ ] Gallery section displays correctly
- [ ] Quick navigation buttons work
- [ ] Video section button works
- [ ] Fullscreen menu opens/closes correctly

### Responsive Testing
- [ ] Mobile (< 576px) - xs breakpoint
- [ ] Tablet portrait (≥ 576px) - sm breakpoint
- [ ] Tablet landscape (≥ 768px) - md breakpoint
- [ ] Desktop (≥ 992px) - lg breakpoint
- [ ] Large desktop (≥ 1200px) - xl breakpoint
- [ ] Extra large (≥ 1400px) - xxl breakpoint

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing
- [ ] Page load time acceptable
- [ ] Images optimized and loading correctly
- [ ] CSS/JS minification (if applicable)
- [ ] No console errors

### Accessibility Testing
- [ ] Semantic HTML structure
- [ ] Alt text for images
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast meets WCAG standards
- [ ] ARIA labels where needed

---

## Future Improvements

### High Priority
1. **Image Optimization**
   - Verify and optimize all gallery images
   - Implement lazy loading for images
   - Add proper alt text for all images

2. **JavaScript Modernization**
   - Complete removal of Mootools dependencies
   - Implement smooth scrolling
   - Add scroll animations (CSS-based preferred)

3. **Typography Enhancement**
   - Consider adding web fonts (Google Fonts or custom)
   - Improve font hierarchy and readability

### Medium Priority
1. **Performance Optimization**
   - Optimize CSS/JS delivery
   - Implement code splitting if needed
   - Add service worker for offline support

2. **Accessibility Improvements**
   - Enhanced ARIA labels
   - Keyboard navigation improvements
   - Focus management improvements

3. **SEO Enhancements**
   - Structured data improvements
   - Meta tags optimization
   - Open Graph tags

### Low Priority
1. **Animation Enhancements**
   - Subtle scroll-triggered animations
   - Improved hover effects
   - Loading animations

2. **User Experience**
   - Add loading states for dynamic content
   - Improve form validation feedback
   - Enhanced error handling

---

## Asset Inventory

### Required Images
- ✅ `/images/top.png` - Header banner image (EXISTS)
- ❓ Banner background images (from SliderService)
- ❓ `/images/photogallery/default.jpg` - Gallery placeholder (needs verification)
- ❓ Decoration images for `.additional_1` and `.additional_2` classes

### Fonts
- Currently: Arial, 'Helvetica Neue', Helvetica, sans-serif
- Consider: Web fonts for improved typography

### Icons
- ✅ Bootstrap Icons 1.11.3 (via CDN)
- Additional icon needs: TBD

---

## Notes

### Technical Decisions
- Bootstrap 5 loaded via CDN for faster delivery
- SCSS compiled to CSS (build process required)
- jQuery retained for compatibility with existing scripts
- Fullscreen menu system implemented alongside Bootstrap navbar

### Design Philosophy
- Preserve original design aesthetic while modernizing code
- Mobile-first responsive approach
- Progressive enhancement strategy
- Accessibility-first mindset

### Dependencies
- Bootstrap 5.3.2 (CDN)
- Bootstrap Icons 1.11.3 (CDN)
- jQuery 3.7.1 (CDN)
- Custom SCSS compilation required

---

## Version History

- **2025-01-XX**: Initial plan created
- **2025-01-XX**: Bootstrap 5.3.2 integration completed
- **2025-01-XX**: SCSS structure created
- **2025-01-XX**: Header and navigation modernized
- **2025-01-XX**: Home page template modernized
- **2025-01-XX**: Plan document updated with status

---

## Related Documentation

- Bootstrap 5 Documentation: https://getbootstrap.com/docs/5.3/
- Bootstrap Icons: https://icons.getbootstrap.com/
- SCSS Documentation: https://sass-lang.com/documentation
