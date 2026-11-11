# Apartment Edit Page Fixes

## Date: October 9, 2025

## Issues Fixed

### 1. Modern Styling Implementation
**Problem**: The apartment edit page was using old panel-based styling while other pages like transactions used modern card-based styling.

**Solution**: 
- Completely rewrote `admin/views/apartments/edit-apartment.ejs` to use AdminLTE 3/Bootstrap 5 card-based styling
- Added `content-wrapper`, `content-header`, and proper breadcrumb navigation
- Modernized all form controls to match the transactions create page style
- Improved responsive layout with proper column structure

### 2. Unit Number Validation Error
**Problem**: When editing an apartment, saving would fail with "Unit number already exists" error even when the unit numbers weren't changed.

**Root Cause**: 
- The database has two fields: `apartment_number` (official) and `apartment_number_unofficial`
- The service was incorrectly mapping these fields
- The `isUnitNumberTaken()` method was only checking one field
- The service wasn't properly excluding the current apartment when validating

**Solution**:
1. Fixed field mappings in `apartmentsService.ts`:
   - `unitNumberOfficial` → `apartment_number` (database)
   - `unitNumberUnofficial` → `apartment_number_unofficial` (database)

2. Updated `addApartment()` method to save both fields correctly:
```typescript
INSERT INTO apartments (apartment_number, apartment_number_unofficial, owner_id, ...)
VALUES (unitNumberOfficial, unitNumberUnofficial, ownerId, ...)
```

3. Updated `updateApartment()` method to update both fields:
```typescript
if (updates.unitNumberOfficial !== undefined) {
  updateFields.push('apartment_number = ?');
  values.push(updates.unitNumberOfficial);
}
if (updates.unitNumberUnofficial !== undefined) {
  updateFields.push('apartment_number_unofficial = ?');
  values.push(updates.unitNumberUnofficial);
}
```

4. Fixed `isUnitNumberTaken()` to check both fields and exclude current apartment:
```typescript
WHERE (apartment_number = ? OR apartment_number_unofficial = ?)
AND id != ?  // Exclude current apartment when editing
```

5. Updated `getAllApartments()` and `getApartmentById()` to correctly read both fields:
```typescript
COALESCE(a.apartment_number_unofficial, a.apartment_number) as unitNumberUnofficial,
a.apartment_number as unitNumberOfficial
```

### 3. Image Upload Functionality
**Problem**: Images weren't being saved when uploaded.

**Solution**:
- Verified upload routes are properly configured in `admin/routes/index.ts` (lines 90-93)
- Verified `StorageService.createApartmentUploadConfig()` properly creates apartment-specific directories
- Ensured `/public/images/apartments/` directory exists
- Upload functionality now works correctly with proper error handling

### 4. User Experience Improvements
**Problem**: The page was using `alert()` and `confirm()` dialogs which don't match project standards.

**Solution**:
- Added three Bootstrap modals:
  - `confirmModal` - For confirmation actions (warning style)
  - `successModal` - For success messages (success style)
  - `errorModal` - For error messages (danger style)
- Replaced all `alert()` calls with `showError()` and `showSuccess()` helper functions
- Replaced all `confirm()` calls with `showConfirm()` helper function
- Added proper loading states for upload operations
- Added automatic page reload after successful image operations

## Files Modified

1. `admin/services/apartmentsService.ts`
   - Fixed `addApartment()` method
   - Fixed `updateApartment()` method  
   - Fixed `isUnitNumberTaken()` method
   - Fixed `getAllApartments()` method
   - Fixed `getApartmentById()` method

2. `admin/views/apartments/edit-apartment.ejs`
   - Complete rewrite with modern styling
   - Added Bootstrap modals
   - Improved form layout and validation
   - Enhanced image upload UI
   - Added proper error handling

## Testing Checklist

- [x] Edit existing apartment - save succeeds without validation errors
- [x] Unit number validation works correctly (prevents duplicates across all apartments)
- [x] Unit number validation allows editing same apartment without errors
- [x] Image upload functionality works
- [x] Official image upload and display works
- [x] Additional images upload and display works
- [x] Image deletion works with proper confirmation
- [x] Set image as official works
- [x] All alerts replaced with Bootstrap modals
- [x] Form validation provides proper feedback
- [x] Page styling matches other admin pages
- [x] Responsive layout works on different screen sizes

## Notes

- The database schema has both `apartment_number` (official, NOT NULL) and `apartment_number_unofficial` (optional)
- Both unit numbers must be unique across all apartments
- When editing, the current apartment's unit numbers are excluded from validation
- Image uploads create apartment-specific directories under `/public/images/apartments/{apartmentId}/`
- All user interactions now use Bootstrap modals instead of native browser dialogs

