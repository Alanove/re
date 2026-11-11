# Real Estate Website Redesign Migration

## Overview
This migration creates the necessary pages and menu structure for the Santa Maria Bouar website redesign as a real estate agency-focused platform.

## Migration File
- `2025-10-10-create-real-estate-pages.sql`

## What This Migration Does

### 1. Creates New Pages
- **Home**: Main landing page with slideshow and overview
- **Apartments for Rent**: Listing page for available rental units
- **Apartments for Sale**: Listing page for units available for purchase
- **Projects**: Information about compound development projects
- **About Compound**: Detailed information about Santa Maria Bouar

### 2. Updates Menu Structure
Creates a clean navigation menu with:
- Home
- For Rent
- For Sale
- Projects
- About
- Contact

## Running the Migration

### Using MySQL Command Line
```bash
mysql -u your_username -p your_database_name < data-migration/2025-10-10-create-real-estate-pages.sql
```

### Using Node.js Migration Script
```bash
cd data-migration
node migrate.js
```

## Post-Migration Steps

1. **Verify Pages**: Check that all pages are created in the database
   ```sql
   SELECT * FROM pages WHERE slug IN ('home', 'apartments-for-rent', 'apartments-for-sale', 'projects-info', 'about-compound');
   ```

2. **Verify Menu**: Check that menu items are created
   ```sql
   SELECT * FROM menu ORDER BY order_index;
   ```

3. **Update Content**: After migration, you can update page content through the admin panel

## Design Changes

The migration is accompanied by:
- New CSS styles for real estate agency look
- Updated home page layout
- New page templates for rent, sale, and about pages
- Modern, clean navigation with login button

## Rollback

To rollback this migration:
```sql
DELETE FROM pages WHERE slug IN ('home', 'apartments-for-rent', 'apartments-for-sale', 'projects-info', 'about-compound');
DELETE FROM menu WHERE url IN ('/', '/apartments-for-rent', '/apartments-for-sale', '/projects-info', '/about-compound');
```

## Notes
- This migration deletes existing pages with the same slugs
- Menu items are recreated to ensure proper order and structure
- All pages are set to 'published' status by default
- Templates are assigned to each page for proper rendering

