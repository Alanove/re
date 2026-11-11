# SCSS Styling Rules

## File Organization

### Menu-Related Styles
- **All menu-related styles should be added to `public/css/menu.scss`**
- This includes:
  - Admin menu management styles
  - Menu statistics cards
  - Menu badges and interactive elements
  - Menu panel styling
  - Any menu-related hover effects and animations

### Admin Panel Styles
- **Admin-specific styles should be added to `admin/public/css/custom.css`**
- This includes:
  - Dashboard styling
  - Form styling
  - Table styling
  - Modal styling
  - General admin UI components

## SCSS Best Practices

### Nesting
- Use SCSS nesting for related selectors
- Keep nesting depth to a maximum of 3 levels
- Use `&` for pseudo-classes and modifiers

### Example Structure
```scss
.menu-section-panel {
  .btn {
    border-radius: 8px;
    font-weight: 600;
    padding: 12px 20px;
    transition: box-shadow 0.3s ease;
    
    &:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  }
}

.menu-badge {
  transition: all 0.2s ease;
  cursor: default;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border-color: #007bff !important;
  }
  
  a {
    opacity: 0.7;
    transition: opacity 0.2s ease;
    
    &:hover {
      color: #0056b3 !important;
    }
  }
  
  &:hover a {
    opacity: 1;
  }
}
```

## Important Notes

1. **Never add menu styles to `admin/public/css/custom.css`**
2. **Always use SCSS syntax in `public/css/menu.scss`**
3. **Use proper nesting and `&` selectors for better maintainability**
4. **Keep styles organized and commented for clarity**

## File Locations

- **Menu Styles**: `public/css/menu.scss`
- **Admin Styles**: `admin/public/css/custom.css`
- **Variables**: `public/css/_variables.scss` (if exists)

## Compilation

Ensure that the SCSS files are properly compiled to CSS and included in the appropriate layout files. 