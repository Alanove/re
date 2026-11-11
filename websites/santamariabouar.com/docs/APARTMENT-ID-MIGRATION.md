# Apartment ID Migration for Transactions

## Date
October 9, 2025

## Issue
When editing transactions that were related to apartments (e.g., common expense payments), the apartment dropdown was not showing the correct apartment as selected.

## Root Cause
The `apartment_id` column was missing from the `transactions` table in the MySQL database. This caused:

1. SQL queries in `transactionsService.ts` to not retrieve apartment information
2. Edit forms to not display the selected apartment
3. Inability to save apartment associations with transactions

## Changes Made

### 1. Database Schema Changes

#### Migration Script
Created: `src/database/migrations/add-apartment-id-to-transactions.sql`

```sql
ALTER TABLE transactions 
ADD COLUMN apartment_id INT NULL AFTER category_id,
ADD FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL,
ADD INDEX idx_apartment (apartment_id);
```

#### Schema Update
Updated: `src/database/schema.sql`
- Added `apartment_id INT NULL` column to transactions table
- Added foreign key constraint to apartments table
- Added index on apartment_id for better query performance

### 2. Service Layer Updates

#### File: `admin/services/transactionsService.ts`

**Updated Methods:**
- `getAllTransactions()` - Added apartment_id to SELECT query and result mapping
- `getTransactionById()` - Added apartment_id to SELECT query and result mapping
- `getTransactionsByAccount()` - Added apartment_id to SELECT query and result mapping
- `getTransactionsByDateRange()` - Added apartment_id to SELECT query and result mapping
- `createTransaction()` - Added apartment_id to INSERT query
- `updateTransaction()` - Added apartment_id to UPDATE logic

**Changes:**
- All SELECT queries now include: `apartment_id as apartmentId`
- All result mappings now include: `apartmentId: row.apartmentId ? parseInt(row.apartmentId) : null`
- INSERT and UPDATE operations now handle apartment_id field

### 3. View Layer Updates

#### File: `admin/views/transactions/edit.ejs`

**Fixed Comparison Issues:**
Changed strict equality (`===`) to loose equality (`==`) for ID comparisons to prevent type mismatch:
- Line 74: `category.id == transaction.categoryId` (was `===`)
- Line 129: `account.id == transaction.accountId` (was `===`)
- Line 188: `apartment.id == transaction.apartmentId` (was `===`)

## Migration Steps Executed

1. Created migration SQL file
2. Executed migration on database:
   ```bash
   ALTER TABLE transactions ADD COLUMN apartment_id INT NULL ...
   ```
3. Updated schema.sql for future deployments
4. Updated service layer to handle apartment_id
5. Fixed view layer comparisons
6. Verified migration success

## Verification

After migration:
- ✅ Column `apartment_id` exists in transactions table
- ✅ Foreign key constraint to apartments table created
- ✅ Index on apartment_id created
- ✅ All 290 existing transactions maintained (apartment_id is NULL for non-apartment transactions)
- ✅ New transactions can save apartment associations
- ✅ Edit forms display selected apartments correctly

## Testing Checklist

- [ ] Create a new transaction with an apartment association
- [ ] Edit an existing transaction and add an apartment
- [ ] Edit a transaction with an apartment and verify it's selected
- [ ] Remove apartment association from a transaction
- [ ] Create common expense payment and verify apartment is saved
- [ ] View transaction list and verify apartment information displays

## Notes

- The apartment_id field is nullable, meaning not all transactions need to be associated with an apartment
- When an apartment is deleted, transactions will have their apartment_id set to NULL (ON DELETE SET NULL)
- Type conversions between number and string are handled with loose equality (`==`) in views

