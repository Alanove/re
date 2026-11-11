# Apartment Images Display Fix

## Date: October 9, 2025

## Issue
Images were not displaying on:
1. **Apartments list page** (`/admin/apartments`) - No images showing in the table
2. **Apartment edit page** (`/admin/apartments/4/edit`) - Official image not showing in sidebar

## Root Cause

The `getAllApartments()` method in `apartmentsService.ts` was not fetching images from the `apartment_images` table. It was returning:
- `officialImage: ''` (empty string)
- `images: []` (empty array)

Even though images were:
- ✅ Saved to disk via multer
- ✅ Saved to database via `addImageToApartment()`
- ✅ Retrieved correctly in `getApartmentById()`

The issue was that the list page uses `getAllApartments()` which wasn't fetching image data.

## Solution

Updated `getAllApartments()` to fetch images for each apartment:

```typescript
// OLD - Images hardcoded to empty
public async getAllApartments(): Promise<Apartment[]> {
  const [rows] = await db.query(`SELECT ... '' as officialImage ...`);
  
  return (rows as any[]).map((row: any) => ({
    ...row,
    images: [],  // Always empty!
    officialImage: '', // Always empty!
  }));
}

// NEW - Images fetched from database
public async getAllApartments(): Promise<Apartment[]> {
  const [rows] = await db.query(`SELECT ... (no officialImage in query)`);
  
  // For each apartment, get the official image
  const apartments = await Promise.all((rows as any[]).map(async (row: any) => {
    const officialImage = await this.getOfficialImage(row.id);
    const images = await this.getApartmentImages(row.id);
    
    return {
      ...row,
      images,
      officialImage,
      ...
    };
  }));
  
  return apartments;
}
```

## Implementation Details

### Database Queries
For each apartment, the service now calls:

1. **`getOfficialImage(apartmentId)`**:
```sql
SELECT image_filename
FROM apartment_images
WHERE apartment_id = ? AND is_official = TRUE
LIMIT 1
```

2. **`getApartmentImages(apartmentId)`**:
```sql
SELECT image_filename
FROM apartment_images
WHERE apartment_id = ? AND is_official = FALSE
ORDER BY display_order, created_at
```

### Performance Consideration
The solution uses `Promise.all()` to fetch images for all apartments in parallel, which is more efficient than fetching them one by one.

```typescript
const apartments = await Promise.all(
  rows.map(async (row) => {
    // Fetches images in parallel for all apartments
    const officialImage = await this.getOfficialImage(row.id);
    const images = await this.getApartmentImages(row.id);
    return { ...row, images, officialImage };
  })
);
```

## Files Modified

1. **`admin/services/apartmentsService.ts`**
   - Updated `getAllApartments()` method
   - Now fetches images from `apartment_images` table
   - Uses `Promise.all()` for parallel queries

## How Images Display Now

### Apartments List Page
```ejs
<% if (apartment.officialImage) { %>
  <img src="/images/apartments/<%= apartment.id %>/<%= apartment.officialImage %>" />
<% } else { %>
  <i class="fa fa-home text-muted"></i>
<% } %>
```

The `apartment.officialImage` now contains the actual filename from the database.

### Apartment Edit Page
```ejs
<% if (apartment.officialImage) { %>
  <img src="/images/apartments/<%= apartment.id %>/<%= apartment.officialImage %>" />
<% } else { %>
  <p>No official image</p>
<% } %>
```

Both pages now display images correctly because:
- `apartment.officialImage` contains the filename
- `apartment.images` contains array of additional image filenames
- Image files exist on disk at `/public/images/apartments/{id}/{filename}`

## Testing Checklist

- [x] Apartments list shows official images for apartments that have them
- [x] Apartments without images show placeholder icon
- [x] Edit page shows official image in sidebar
- [x] Edit page shows additional images in grid
- [x] Image paths are correct: `/images/apartments/{id}/{filename}`
- [x] Images load properly from disk

## Image Flow Summary

### Upload Flow:
1. User uploads image via form
2. Multer saves to `/public/images/apartments/{id}/{filename}`
3. Controller calls `apartmentsService.addImageToApartment(id, filename)`
4. Service inserts record into `apartment_images` table
5. Page reloads
6. Images fetched from database and displayed ✓

### Display Flow:
1. Controller calls `apartmentsService.getAllApartments()` or `getApartmentById(id)`
2. Service queries `apartments` table for basic info
3. Service queries `apartment_images` table for image filenames
4. Returns apartment objects with `officialImage` and `images` fields
5. View renders image tags with correct paths
6. Browser loads images from `/public/images/apartments/{id}/{filename}` ✓

## Key Points

1. **Database is source of truth** for image references
2. **Files exist on disk** at `/public/images/apartments/{id}/`
3. **Service layer** handles all database queries
4. **Controllers** pass data to views
5. **Views** render image tags with correct paths

All images now display correctly on both list and edit pages! ✅

