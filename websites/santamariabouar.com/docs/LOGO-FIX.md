# Logo Fix - Reading from Database Settings

## Date: October 10, 2025

## Issue
The logo was not displaying on the home page because the `pagesService` was looking for incorrect field names when reading from the site settings.

## Root Cause
The `getSiteData()` method in `src/services/pagesService.ts` was using old field names:
- Looking for: `site_logo`, `site_name`, `site_url`, `site_description`
- Actual fields from SiteSettingsService: `logo`, `siteTitle`, `siteUrl`, `siteDescription`

## Solution

### Fixed Field Mappings in `src/services/pagesService.ts`

**Before:**
```typescript
getSiteData(): SiteData {
  const settings = this.cachedSettings || {};
  return {
    name: settings.site_name || 'Santa Maria Bouar',
    domain: settings.site_url || 'http://localhost:3002',
    description: settings.site_description || '',
    logo: settings.site_logo || '/images/logo.png',
    favicon: settings.site_favicon || '/images/favicon.ico',
    social: {
      linkedin: settings.social_linkedin || '',
      facebook: settings.social_facebook || ''
    }
  };
}
```

**After:**
```typescript
getSiteData(): SiteData {
  const settings = this.cachedSettings || {};
  return {
    name: settings.siteTitle || 'Santa Maria Bouar',
    domain: settings.siteUrl || 'http://localhost:3002',
    description: settings.siteDescription || '',
    logo: settings.logo || '/images/logo.png',
    favicon: settings.favicon || '/images/favicon.ico',
    social: {
      linkedin: settings.socialMedia?.linkedin || '',
      facebook: settings.socialMedia?.facebook || ''
    }
  };
}
```

### Also Fixed SEO Data
Updated `getSeoData()` method to use correct nested field names:
- `settings.seo?.defaultTitle` instead of `settings.seo_title`
- `settings.seo?.defaultDescription` instead of `settings.seo_description`
- `settings.seo?.defaultKeywords` instead of `settings.seo_keywords`

## How It Works Now

### 1. Settings Source
- Settings are stored in MySQL database table: `site_settings`
- Loaded by `SiteSettingsService` with keys: `logo`, `siteTitle`, etc.

### 2. Cache Flow
```
Database (site_settings table)
    ↓
SiteSettingsService.loadSettings()
    ↓
PagesService.cachedSettings
    ↓
PagesService.getSiteData()
    ↓
res.locals.siteData
    ↓
EJS Templates (siteData.logo)
```

### 3. Logo Path Resolution
- Database stores: `/images/logo-1759813853497-882930560.png`
- Cached by: `PagesService` (refreshes every 30 seconds)
- Accessed via: `siteData.logo` in templates
- Fallback: `/images/logo.png` if not set

## Testing

### Verify Logo Display
1. Visit: http://localhost:3002
2. Check home page hero section
3. Logo should display at top center
4. Logo should be: `/images/logo-1759813853497-882930560.png`

### Verify Dynamic Updates
1. Go to Admin Panel → Site Settings
2. Upload new logo
3. Wait 30 seconds (cache refresh)
4. Refresh home page
5. New logo should appear

## Files Modified
- `src/services/pagesService.ts` - Fixed field name mappings

## Result
✅ Logo now correctly reads from database settings
✅ Dynamic updates work (changes in admin reflect on site)
✅ All pages access logo via `siteData.logo`
✅ Cache refreshes every 30 seconds

## Server Restart Required
Yes - Changes require server restart to take effect:
```bash
npm run dev
```

## Status
🎉 **Fixed and Working!**

The logo now displays correctly on the home page and automatically updates when changed in the admin panel.

