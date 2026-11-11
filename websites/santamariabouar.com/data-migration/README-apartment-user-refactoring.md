# Apartment-User Relationship Refactoring

## Overview

This document describes the refactoring of the apartment-user relationship in the Santa Maria Bouar CMS project. The goal is to properly normalize the database by removing redundant data and ensuring all apartment-owner relationships are properly linked through foreign keys.

## Problem Statement

The original database design had some redundancy:
- The `apartments` table stored `owner_name`, `owner_phone`, and `owner_email` columns
- The `users` table also stored user information
- This created data duplication and potential inconsistencies

## Solution

The refactoring involves:
1. **Ensuring all apartments have valid `owner_id`** links to the users table
2. **Removing redundant columns** from the apartments table
3. **Updating services and controllers** to use proper JOINs or views
4. **Creating efficient views** for common apartment-owner queries

## Migration Steps

### Step 1: Run the Relationship Migration
```bash
npx ts-node data-migration/2025-01-15-refactor-apartment-user-relationship.ts
```

This migration:
- Creates users for apartments without owners
- Ensures all apartments have valid `owner_id`
- Adds performance indexes
- Creates the `apartment_owners` view
- Logs the migration

### Step 2: Test Functionality
After running the first migration, test all admin panel functionality:
- Apartment management
- User management
- Transactions
- Payments
- Reports

### Step 3: Remove Redundant Columns (Optional)
Only run this after confirming everything works:
```bash
npx ts-node data-migration/2025-01-15-remove-redundant-apartment-columns.ts
```

This migration:
- Removes `owner_name`, `owner_phone`, `owner_email` from apartments table
- Creates a backup of the redundant data
- Verifies the changes

## Database Changes

### New View: `apartment_owners`
```sql
CREATE OR REPLACE VIEW apartment_owners AS
SELECT 
  a.id as apartment_id,
  a.apartment_number,
  a.apartment_number_unofficial,
  a.floor,
  a.size,
  a.status,
  a.registration_date,
  a.notes,
  a.created_at as apartment_created_at,
  u.id as owner_id,
  u.username as owner_name,
  u.email as owner_email,
  u.phone as owner_phone,
  u.role as owner_role,
  u.status as owner_status
FROM apartments a
LEFT JOIN users u ON a.owner_id = u.id;
```

### New Indexes
- `idx_apartments_owner_id` - For efficient owner lookups
- `idx_apartments_status` - For status filtering
- `idx_apartments_floor` - For block filtering

## Service Layer Changes

### ApartmentsService
- Updated `getApartmentsByOwner()` to use proper JOINs
- Updated `getApartmentsByBlock()` to use proper JOINs
- Updated `getApartmentsByStatus()` to use proper JOINs
- Added `getApartmentsWithOwners()` - uses the view for efficiency
- Added `getApartmentsByOwnerId()` - uses the view for efficiency

### UsersService
- Added `getUsersWithApartmentCount()` - shows apartment count per user
- Added `getUserWithApartments()` - gets user with their apartments

## Controller Changes

### ApartmentsController
- Updated `apartments()` method to use `getApartmentsWithOwners()`
- More efficient data loading
- Cleaner code without manual mapping

## Benefits

1. **Data Consistency**: No more duplicate owner information
2. **Performance**: Efficient queries using views and indexes
3. **Maintainability**: Single source of truth for user data
4. **Scalability**: Better support for users with multiple apartments
5. **Data Integrity**: Foreign key constraints ensure data consistency

## Rollback Plan

If issues arise, you can rollback by:

1. **Restore redundant columns**:
```sql
ALTER TABLE apartments 
ADD COLUMN owner_name VARCHAR(255),
ADD COLUMN owner_phone VARCHAR(50),
ADD COLUMN owner_email VARCHAR(255);
```

2. **Populate from backup**:
```sql
UPDATE apartments a
JOIN apartments_backup_redundant_columns b ON a.id = b.id
SET a.owner_name = b.owner_name,
    a.owner_phone = b.owner_phone,
    a.owner_email = b.owner_email;
```

3. **Revert service changes** to use the old methods

## Testing Checklist

After running the migrations, test these areas:

### Admin Panel
- [ ] Apartment listing page loads correctly
- [ ] Apartment creation works
- [ ] Apartment editing works
- [ ] Apartment deletion works
- [ ] User listing shows apartment counts
- [ ] User editing works
- [ ] User deletion handles apartment ownership

### Transactions
- [ ] Transaction creation with apartment selection
- [ ] Transaction listing shows apartment owners
- [ ] Transaction editing works
- [ ] Transaction deletion works

### Payments
- [ ] Payment generation for apartments
- [ ] Payment recording works
- [ ] Payment reports show correct owner information

### Reports
- [ ] Apartment reports work
- [ ] User reports work
- [ ] Financial reports work

## Performance Considerations

- The `apartment_owners` view provides efficient access to apartment-owner data
- New indexes improve query performance
- Service methods are optimized for common use cases
- Consider adding more indexes based on actual usage patterns

## Future Enhancements

1. **User Roles**: Consider adding apartment-specific roles (e.g., "Apartment Owner", "Tenant")
2. **Ownership History**: Track ownership changes over time
3. **Multiple Owners**: Support for joint ownership
4. **Tenant Management**: Separate tenant information from owner information

## Monitoring

After deployment, monitor:
- Query performance for apartment-owner operations
- Database size (should be smaller due to removed redundancy)
- Application performance
- Error logs for any issues

## Support

If you encounter issues:
1. Check the migration logs in the `migrations` table
2. Verify all apartments have valid `owner_id`
3. Test the `apartment_owners` view
4. Check application logs for errors
5. Consider rolling back if critical issues arise
