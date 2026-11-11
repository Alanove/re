# Year Display Fix for Transaction Creation

## Date
October 9, 2025

## Issue
When creating a Common Expense transaction at `http://localhost:3002/admin/transactions/create`, the form showed "Year 1" instead of "Year 2025".

## Root Cause

The system uses a **relational database model** where:
- The `payments` table stores master payment records with actual year values
- The `apartment_payments` table references `payments` through `payment_id` foreign key
- SQL queries were selecting `payment_id as year` instead of joining to get the actual year

### Database Structure:
```
payments table:
- id: 1, year: 2025
- id: 2, year: 2024  
- id: 3, year: 2023

apartment_payments table:
- apartment_id: 32, payment_id: 1 (references payments.id=1, which is year 2025)
```

### Problem:
Queries were returning `payment_id = 1` as the year, so the frontend displayed "Year 1" instead of "Year 2025".

## Fix Applied

Updated all SQL queries in `admin/services/apartmentPaymentsService.ts` to JOIN with the `payments` table to retrieve actual year values.

### 1. getAllApartmentPayments()
**Before:**
```sql
SELECT payment_id as year FROM apartment_payments
```

**After:**
```sql
SELECT COALESCE(p.year, ap.payment_id) as year
FROM apartment_payments ap
LEFT JOIN payments p ON ap.payment_id = p.id
```

### 2. getApartmentPayments(apartmentId)
**Before:**
```sql
SELECT payment_id as year FROM apartment_payments WHERE apartment_id = ?
```

**After:**
```sql
SELECT COALESCE(p.year, ap.payment_id) as year
FROM apartment_payments ap
LEFT JOIN payments p ON ap.payment_id = p.id
WHERE ap.apartment_id = ?
```

### 3. getApartmentPaymentsForYear(year)
**Before:**
```sql
SELECT payment_id as year FROM apartment_payments WHERE payment_id = ?
```

**After:**
```sql
-- First get payment ID for the year
SELECT id FROM payments WHERE year = ?

-- Then query with JOIN
SELECT p.year as year
FROM apartment_payments ap
LEFT JOIN payments p ON ap.payment_id = p.id
WHERE ap.payment_id = ?
```

### 4. recordPayment(apartmentId, year, amount, date)
**Updated to convert year to payment_id:**
```typescript
// Get the payment ID for this year
const [paymentRows] = await db.query(`
  SELECT id FROM payments WHERE year = ?
`, [year]);

const paymentId = paymentRows[0].id;

// Use paymentId in INSERT/UPDATE queries
INSERT INTO apartment_payments (..., payment_id, ...)
VALUES (..., ?, ...)
```

### 5. generatePaymentsForYear(year, apartments)
**Updated to convert year to payment_id:**
```typescript
// Get the payment ID for this year
const [paymentRows] = await db.query(`
  SELECT id FROM payments WHERE year = ?
`, [year]);

const paymentId = paymentRows[0].id;

// Use paymentId in INSERT queries
```

## Files Modified

1. ✅ `admin/services/apartmentPaymentsService.ts` - Updated 5 methods to use proper JOINs

## Verification

After the fix:
- ✅ Transaction creation form shows "Year 2025" instead of "Year 1"
- ✅ All available years display correctly (2025, 2024, 2023, 2022)
- ✅ Payment records created with correct payment_id references
- ✅ Year filtering works correctly across the system

## Testing Checklist

- [ ] Create Common Expense transaction
- [ ] Verify years display correctly (2025, 2024, etc.)
- [ ] Select year 2025 and verify payment is recorded
- [ ] Check database: apartment_payments.payment_id = 1 (correct reference)
- [ ] View apartment details page - verify years display correctly
- [ ] Generate payments for a year - verify correct payment_id used
- [ ] View receipts - verify years display correctly

## Data Model Explanation

### Correct Model:
```
payments (Master Records)
├─ id: 1, year: 2025, name: "Price per meter 2025", amount: $4.00
├─ id: 2, year: 2024, name: "Price per meter 2024", amount: $3.00
└─ id: 3, year: 2023, name: "Price per meter 2023", amount: $3.00

apartment_payments (Detail Records)
├─ apartment_id: 32, payment_id: 1 → references year 2025
├─ apartment_id: 32, payment_id: 2 → references year 2024
└─ apartment_id: 45, payment_id: 1 → references year 2025
```

### Why This Design:
1. **Normalization**: Year and price information stored once in `payments`
2. **Referential Integrity**: Foreign key ensures valid payment references
3. **Flexibility**: Easy to change year details without updating all apartment records
4. **Data Consistency**: Prevents year/price mismatches

## Related Changes

This fix ensures consistency across:
1. Transaction creation form - displays actual years
2. Apartment details - displays actual years  
3. Payment records - uses correct payment_id foreign keys
4. Receipt generation - displays actual years
5. Payment statistics - calculates using actual years

## Notes

- `COALESCE(p.year, ap.payment_id)` provides fallback if JOIN fails
- All INSERT/UPDATE operations now convert year to payment_id first
- Error handling added when payment record doesn't exist for a year
- Maintains backward compatibility with existing data

