# Apartment Statement and Payment Buttons Feature

## Date
October 9, 2025

## Overview
Added two new action buttons to the apartments listing page:
1. **Display Statement** - Shows account statement with payment history
2. **Add Payment** - Quick link to create a payment for the apartment

## Implementation

### 1. Apartments Listing Page - Button Addition

**File**: `admin/views/apartments/apartments.ejs`

#### Changes Made:

**A. Updated Actions Column Header**
```html
<th width="1%">Actions</th>
```

**B. Added Two New Buttons**
```html
<div class="btn-group" style="white-space: nowrap;">
  <!-- NEW: Statement Button -->
  <a href="/admin/apartments/<%= apartment.id %>/statement" 
     class="btn btn-sm btn-info" 
     title="View Statement" 
     target="_blank">
    <i class="fa fa-file-text"></i>
  </a>
  
  <!-- NEW: Add Payment Button -->
  <a href="/admin/transactions/create?apartmentId=<%= apartment.id %>" 
     class="btn btn-sm btn-success" 
     title="Add Payment">
    <i class="fa fa-plus"></i>
  </a>
  
  <!-- Existing Edit Button -->
  <a href="/admin/apartments/<%= apartment.id %>/edit" 
     class="btn btn-sm btn-primary" 
     title="Edit">
    <i class="fa fa-edit"></i>
  </a>
  
  <!-- Existing Delete Button -->
  <button type="button" class="btn btn-sm btn-danger" 
          title="Delete" 
          onclick="deleteItem(...)">
    <i class="fa fa-trash"></i>
  </button>
</div>
```

### 2. Statement View Creation

**File**: `admin/views/apartments/statement.ejs` (NEW)

#### Features:
- Displays apartment and owner information
- Shows complete payment history table with:
  - Year
  - Due Amount
  - Amount Paid
  - Balance
  - Status (Paid/Partial/Unpaid)
- Shows credit balance if available
- Displays total row with summary
- Auto-prints when opened (for easy PDF generation)
- Responsive design similar to receipts

#### Styling:
- Professional invoice-style layout
- Consistent with existing receipt design
- Print-optimized with proper page breaks
- Color-coded status indicators

### 3. Controller Method Addition

**File**: `admin/controllers/apartmentsController.ts`

#### New Method: `apartmentStatement`
```typescript
public static async apartmentStatement(req: Request, res: Response): Promise<void> {
  try {
    const apartmentId = parseInt(req.params.id);
    
    // Get apartment details
    const apartment = await apartmentsService.getApartmentById(apartmentId);
    if (!apartment) {
      res.status(404).send('Apartment not found');
      return;
    }

    // Get owner info
    const owner = await usersService.getUserById(apartment.ownerId);
    
    // Get site settings for logo
    const siteSettings = await siteSettingsService.getAllSettings();
    
    // Get all apartment payments
    const allApartmentPayments = await apartmentPaymentsService.getApartmentPayments(apartmentId);
    
    res.render('apartments/statement', {
      title: 'Account Statement',
      apartment,
      owner,
      siteSettings,
      allApartmentPayments,
      layout: false // Don't use admin layout for statement
    });
  } catch (error) {
    console.error('Error generating apartment statement:', error);
    res.status(500).send('Error generating statement');
  }
}
```

### 4. Route Configuration

**File**: `admin/routes/index.ts`

#### New Route Added:
```typescript
router.get('/apartments/:id/statement', 
  AdminController.requireAuth, 
  requireRole(['Super Admin', 'Admin', 'Accounting']), 
  ApartmentsController.apartmentStatement
);
```

**Access Control**: Super Admin, Admin, and Accounting roles can access the statement.

### 5. Add Payment Integration

The **Add Payment** button leverages the existing transaction creation functionality:

**URL Format**: `/admin/transactions/create?apartmentId=<apartment_id>`

**Existing Functionality** (already implemented in `admin/views/transactions/create.ejs`):
- Automatically pre-selects the apartment
- Auto-selects "Common Expenses" category
- Loads available payment years for the apartment
- Generates appropriate description

This seamless integration means no additional code was needed for the Add Payment functionality.

## User Experience

### Statement Button
1. User clicks the blue info button (📄 icon) in the Actions column
2. Statement opens in a new tab
3. Automatically triggers print dialog for PDF generation
4. Shows complete payment history with color-coded status
5. Can be saved as PDF for records

### Add Payment Button
1. User clicks the green success button (➕ icon) in the Actions column
2. Redirects to transaction creation form
3. Apartment is pre-selected
4. Common Expenses category is pre-selected
5. Available payment years are loaded automatically
6. User only needs to:
   - Enter amount
   - Select payment year(s)
   - Choose account
   - Submit

## Benefits

1. **Efficiency**: Quick access to statement and payment creation from apartment listing
2. **Consistency**: Uses existing receipt design patterns and transaction creation flow
3. **Accessibility**: Available to appropriate roles (Super Admin, Admin, Accounting)
4. **User-Friendly**: Minimal clicks required for common tasks
5. **Professional**: Auto-print feature for easy PDF generation of statements

## Technical Notes

- Statement view uses `layout: false` to render without admin layout (for printing)
- Buttons use Bootstrap classes for consistent styling
- Statement calculation logic reused from receipt template
- Payment years automatically loaded based on apartment registration date
- Credit balances displayed separately in statement

## Testing Checklist

- [✓] Statement button opens statement in new tab
- [✓] Statement displays correct apartment and owner information
- [✓] Payment history shows all years with correct amounts
- [✓] Status colors are correct (green=paid, yellow=partial, red=unpaid)
- [✓] Credit balance displays if available
- [✓] Total row calculates correctly
- [✓] Auto-print triggers on page load
- [✓] Add Payment button redirects to transaction form
- [✓] Apartment pre-selected in transaction form
- [✓] Common Expenses category pre-selected
- [✓] Available years load automatically
- [✓] Form submission creates transaction successfully
- [✓] Role-based access control works correctly

## Screenshots Location

The apartments page now shows four action buttons for each apartment:
1. 🔵 Blue (Info) - Display Statement
2. 🟢 Green (Success) - Add Payment
3. 🔵 Blue (Primary) - Edit
4. 🔴 Red (Danger) - Delete

