# Apartment Edit Page - Final Fixes

## Date: October 9, 2025

## Issues Reported and Fixed

### 1. Modal Not Closing ✅
**Problem**: When clicking "Close" on success modal after image upload, the modal wouldn't close.

**Root Cause**: Missing proper Bootstrap modal attributes and incorrect Font Awesome syntax.

**Solution**:
- Changed `fa` to `fas` for Font Awesome 5 syntax
- Added proper `role="dialog"` and `role="document"` attributes
- Added `aria-label="Close"` to close buttons
- Removed conflicting `text-white` class from modal headers
- Fixed modal structure to match Bootstrap 5 standards

### 2. Weird Characters in Modal Title ✅
**Problem**: Modal titles displayed weird characters instead of icons.

**Root Cause**: Using `fa` class instead of `fas` (Font Awesome Solid).

**Solution**:
- Changed all icon classes from `fa fa-*` to `fas fa-*`
- This properly renders Font Awesome 5 icons

### 3. Images Not Being Uploaded/Updated ✅
**Problem**: Images appeared to upload successfully but weren't actually saved or displayed after page reload.

**Root Cause**: 
- Images were being uploaded to disk via multer
- But they weren't being stored in the database
- The `apartmentsService` methods were stub implementations that just returned `true`
- The apartment interface had an `images` array but it was always empty

**Solution**:

#### A. Created Database Table for Image Storage
Created new table `apartment_images`:
```sql
CREATE TABLE apartment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    image_filename VARCHAR(255) NOT NULL,
    is_official BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    INDEX idx_apartment (apartment_id),
    INDEX idx_official (apartment_id, is_official)
)
```

#### B. Implemented Image Storage Methods
Updated `admin/services/apartmentsService.ts`:
- `addImageToApartment()` - Inserts image record into database
- `removeImageFromApartment()` - Deletes image record
- `setOfficialImage()` - Sets one image as official (unsets all others first)
- `removeOfficialImage()` - Removes official status
- `getApartmentImages()` - Retrieves all non-official images
- `getOfficialImage()` - Retrieves the official image filename

#### C. Updated Apartment Retrieval
Modified `getApartmentById()` to fetch images from database:
```typescript
const images = await this.getApartmentImages(id);
const officialImage = await this.getOfficialImage(id);
```

### 4. Unit Number Validation Error ✅
**Problem**: When editing an apartment without changing unit numbers, save would fail with "Unit number already exists" error.

**Root Cause**: 
- Validation was checking if unit numbers existed in database
- It was finding the current apartment's own unit numbers
- Even though `excludeId` parameter was passed, the logic wasn't comparing with current values

**Solution**:
Modified `admin/controllers/apartmentsController.ts` `editApartmentPost()`:
```typescript
// Get current apartment to compare
const currentApartment = await apartmentsService.getApartmentById(apartmentId);

// Check if unit numbers are already taken (excluding current apartment)
// Only check if the unit numbers have changed
const unofficialChanged = unitNumberUnofficial !== currentApartment.unitNumberUnofficial;
const officialChanged = unitNumberOfficial !== currentApartment.unitNumberOfficial;

if (unofficialChanged && await apartmentsService.isUnitNumberTaken(unitNumberUnofficial, apartmentId)) {
  return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Unofficial unit number already exists`);
}

if (officialChanged && await apartmentsService.isUnitNumberTaken(unitNumberOfficial, apartmentId)) {
  return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Official unit number already exists`);
}
```

This approach:
- Fetches the current apartment data first
- Compares new values with current values
- Only validates if the values have actually changed
- Provides more specific error messages

## Files Created

1. `data-migration/2025-10-09-apartment-images.sql` - Database migration for apartment_images table
2. `data-migration/2025-10-09-run-apartment-images.js` - Migration runner script
3. `docs/APARTMENT-EDIT-FINAL-FIXES.md` - This documentation

## Files Modified

1. `admin/views/apartments/edit-apartment.ejs`
   - Fixed modal HTML structure
   - Changed icon classes from `fa` to `fas`
   - Added better error handling and logging to upload functions

2. `admin/controllers/apartmentsController.ts`
   - Improved validation logic to compare with current values
   - Added more specific error messages

3. `admin/services/apartmentsService.ts`
   - Implemented actual image storage methods using database
   - Added `getApartmentImages()` and `getOfficialImage()` methods
   - Updated `getApartmentById()` to fetch images from database

## Database Schema Addition

```sql
apartment_images
├── id (PK)
├── apartment_id (FK → apartments.id)
├── image_filename
├── is_official (BOOLEAN)
├── display_order
└── created_at
```

## Testing Checklist

- [x] Edit apartment without changing unit numbers - saves successfully
- [x] Upload official image - saves to disk and database
- [x] Upload additional images - saves to disk and database  
- [x] Page reload - images display correctly
- [x] Delete image - removes from disk and database
- [x] Set image as official - updates database flags
- [x] Modal close buttons work correctly
- [x] Modal icons display correctly (no weird characters)
- [x] Success/error messages display in modals
- [x] Image grid updates after upload without page reload

## How It Works Now

### Image Upload Flow:
1. User selects image file
2. JavaScript FormData sends to `/admin/apartments/:id/upload-image`
3. Multer middleware saves file to `/public/images/apartments/{apartmentId}/`
4. Controller calls `apartmentsService.addImageToApartment(apartmentId, filename)`
5. Service inserts record into `apartment_images` table
6. Controller returns success with filename
7. JavaScript adds image to grid dynamically
8. On page reload, `getApartmentById()` fetches images from database

### Unit Number Validation Flow:
1. User submits edit form
2. Controller fetches current apartment data
3. Compares form values with current values
4. Only validates changed fields against database
5. Excludes current apartment from validation check
6. Provides specific error message if duplicate found
7. Updates apartment if all validations pass

## Notes

- Images are stored both on disk (for serving) and in database (for tracking)
- The `is_official` flag ensures only one official image per apartment
- Images are loaded from database on every apartment page load
- Physical files are deleted from disk when image records are deleted
- Unit number validation is optimized to avoid unnecessary database checks

