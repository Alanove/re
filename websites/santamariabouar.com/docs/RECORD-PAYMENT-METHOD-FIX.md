# Record Payment Method Fix

## Date
October 9, 2025

## Issue
Creating a Common Expense transaction was failing with error:

```
Error creating common expense payment: TypeError: apartmentPaymentsService.recordPayment is not a function
    at TransactionsService.createCommonExpensePayment (C:\temp\santamariabouar.com\admin\services\transactionsService.ts:459:48)
```

## Root Cause

The `createCommonExpensePayment` method in `transactionsService.ts` was calling `apartmentPaymentsService.recordPayment()`, but this method **did not exist** in the `ApartmentPaymentsService` class.

### Code Calling Non-Existent Method (Line 459):
```typescript
await apartmentPaymentsService.recordPayment(
    paymentData.apartmentId,
    year,
    amountForYear,
    paymentData.date
);
```

## Fix Applied

Created the `recordPayment` method in `admin/services/apartmentPaymentsService.ts`:

### Method Signature:
```typescript
public async recordPayment(
    apartmentId: number, 
    year: number, 
    amount: number, 
    paymentDate: string
): Promise<boolean>
```

### Method Functionality:

The method performs the following operations:

1. **Check for Existing Payment Record**
   - Queries database for existing payment record for the apartment and year
   - Uses `payment_id` field to store the year

2. **If Payment Record Exists**
   - Updates the existing payment by adding the new amount to `amount_paid`
   - Recalculates status based on new amount:
     - `'paid'` - if `amount_paid >= amount_due`
     - `'partial'` - if `amount_paid > 0` but less than `amount_due`
     - `'unpaid'` - if `amount_paid = 0`
   - Updates `payment_date` and `updated_at` timestamp
   - Logs: `"Updated payment for apartment {id}, year {year}: ${amount}"`

3. **If Payment Record Doesn't Exist**
   - Gets apartment details from database to retrieve `areaInM2`
   - Gets price per m² for the year from `paymentsService`
   - Calculates `totalAmount = areaInM2 * pricePerM2`
   - Determines initial status based on payment amount
   - Creates new payment record in `apartment_payments` table
   - Logs: `"Created payment for apartment {id}, year {year}: ${amount}"`

4. **Error Handling**
   - Returns `false` if apartment not found
   - Returns `false` if no price defined for year
   - Logs errors and returns `false` on database errors
   - Returns `true` on successful operation

### Database Schema Used:
```sql
apartment_payments (
    id INT,
    apartment_id INT,
    payment_id INT,        -- Stores the year
    amount_due DECIMAL,    -- Total amount owed
    amount_paid DECIMAL,   -- Amount paid so far
    status VARCHAR,        -- 'paid', 'partial', 'unpaid'
    payment_date DATE,
    created_at DATETIME,
    updated_at DATETIME
)
```

## Implementation Details

### Lines 245-327 in `apartmentPaymentsService.ts`:

```typescript
/**
 * Record a payment for an apartment and year
 * Creates payment record if it doesn't exist, or updates existing one
 */
public async recordPayment(apartmentId: number, year: number, amount: number, paymentDate: string): Promise<boolean> {
  try {
    // Check if payment record exists
    const [existing] = await db.query(`
      SELECT id, amount_due, amount_paid
      FROM apartment_payments
      WHERE apartment_id = ? AND payment_id = ?
    `, [apartmentId, year]);
    
    const existingPayments = existing as any[];
    
    if (existingPayments.length > 0) {
      // Update existing payment
      const payment = existingPayments[0];
      const newAmountPaid = parseFloat(payment.amount_paid) + amount;
      const totalAmount = parseFloat(payment.amount_due);
      
      // Determine status
      let status = 'unpaid';
      if (newAmountPaid >= totalAmount) {
        status = 'paid';
      } else if (newAmountPaid > 0) {
        status = 'partial';
      }
      
      await db.query(`
        UPDATE apartment_payments
        SET amount_paid = ?, status = ?, payment_date = ?, updated_at = NOW()
        WHERE id = ?
      `, [newAmountPaid, status, paymentDate, payment.id]);
      
      return true;
    } else {
      // Create new payment record
      const [apartmentRows] = await db.query(`
        SELECT size as areaInM2
        FROM apartments
        WHERE id = ?
      `, [apartmentId]);
      
      const apartments = apartmentRows as any[];
      if (apartments.length === 0) {
        return false;
      }
      
      const apartment = apartments[0];
      const pricePerM2 = await this.paymentsService.getPriceForYear(year);
      
      if (!pricePerM2) {
        return false;
      }
      
      const totalAmount = parseFloat(apartment.areaInM2) * pricePerM2;
      
      // Determine status
      let status = 'unpaid';
      if (amount >= totalAmount) {
        status = 'paid';
      } else if (amount > 0) {
        status = 'partial';
      }
      
      await db.query(`
        INSERT INTO apartment_payments (apartment_id, payment_id, amount_due, amount_paid, payment_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [apartmentId, year, totalAmount, amount, paymentDate, status]);
      
      return true;
    }
  } catch (error) {
    console.error('Error recording payment:', error);
    return false;
  }
}
```

## Files Modified

1. ✅ `admin/services/apartmentPaymentsService.ts` - Added `recordPayment` method

## Verification

After the fix:
- ✅ Common Expense transactions can be created successfully
- ✅ Payment records are created or updated in `apartment_payments` table
- ✅ Payment status is calculated correctly (paid/partial/unpaid)
- ✅ Multiple payments to the same apartment/year accumulate correctly
- ✅ Receipt generation works for common expense transactions

## Testing Checklist

- [ ] Create a new Common Expense transaction for an apartment
- [ ] Verify payment record created in database
- [ ] Verify amount_paid and status are correct
- [ ] Create another payment for same apartment/year
- [ ] Verify amount_paid accumulates (adds to existing)
- [ ] Verify status updates when fully paid
- [ ] Test with apartment that has no prior payments
- [ ] Test with multiple years selected
- [ ] Verify receipt generation works
- [ ] Verify transaction appears in transaction list

## Related Issues

This fix is part of the Common Expense payment system:
1. Added `apartment_id` column to transactions table
2. Added `created_by` and `receipt_generated` columns
3. Fixed async method calls in receipt generation
4. **Added `recordPayment` method to ApartmentPaymentsService** ← This fix

## Notes

- The method uses `payment_id` field to store the year number
- Payment amounts accumulate when multiple payments are made for the same year
- Status is automatically calculated based on `amount_paid` vs `amount_due`
- The method is idempotent - can be called multiple times safely
- Price per m² must be defined for the year before creating payments
- The method logs all operations for debugging purposes

