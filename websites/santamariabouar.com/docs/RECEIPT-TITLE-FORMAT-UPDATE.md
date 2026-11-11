# Receipt Title Format Update

## Date
October 9, 2025

## Change Request
Update the receipt title format to include complete apartment and owner information.

## Previous Format
- Browser tab: `Receipt #809`
- Page title: `Receipt`

## New Format
- Browser tab: `809 - Block C 8 (201) - May Moussa`
- Page title: `Receipt` (unchanged - kept for clean receipt appearance)

## Format Structure
```
{Receipt Number} - Block {Block} {Official Number} ({Unofficial Number}) - {Owner Name}
```

### Components:
1. **Receipt Number**: Calculated as 516 + transaction ID
2. **Block**: Apartment block (e.g., "C")
3. **Official Number**: Official apartment number (e.g., "8")
4. **Unofficial Number**: Unofficial apartment number (e.g., "201")
5. **Owner Name**: Name of the apartment owner (e.g., "May Moussa")

## Implementation

### File Modified
`admin/views/transactions/receipt.ejs`

### Changes Made

#### 1. HTML Document Title (Line 5)
**Before:**
```html
<title>Receipt #<%= receiptNumber %></title>
```

**After:**
```html
<title><%= receiptNumber %><% if (apartment && owner) { %> - Block <%= apartment.block %> <%= apartment.unitNumberOfficial %> (<%= apartment.unitNumberUnofficial %>) - <%= owner.name %><% } %></title>
```

#### 2. Page Title (Line 228-230)
**Kept unchanged for clean receipt appearance:**
```html
<div class="invoice-title">Receipt</div>
```

The visible title on the receipt remains as "Receipt" to maintain a professional and clean look.

## Examples

### Common Expense Receipt (Transaction 293)
- **Receipt Number**: 809 (516 + 293)
- **Apartment**: Block C, Official #8, Unofficial #201
- **Owner**: May Moussa
- **Browser Tab**: `809 - Block C 8 (201) - May Moussa`
- **Page Title**: `Receipt`

### Non-Apartment Transaction
For transactions without apartment association:
- **Browser Tab**: `{Receipt Number}` only (e.g., `517`)
- **Page Title**: `Receipt`

## Conditional Rendering

The title includes apartment and owner information only when both are available:
```javascript
<% if (apartment && owner) { %>
    - Block <%= apartment.block %> <%= apartment.unitNumberOfficial %> (<%= apartment.unitNumberUnofficial %>) - <%= owner.name %>
<% } %>
```

This ensures:
- Common expense receipts show full information
- Non-apartment transactions show only receipt number
- No errors if data is missing

## Benefits

1. **Improved Identification**: Receipt can be identified in browser tab without opening it
2. **Better Organization**: Browser tabs show complete information at a glance
3. **Professional Look**: Receipt page maintains clean "Receipt" title
4. **User-Friendly**: Owner immediately sees their apartment details in tab
5. **Searchability**: Complete information in browser history and bookmarks
6. **Multi-Tab Management**: Easy to distinguish between multiple open receipts

## Testing Checklist

- [ ] Generate receipt for common expense transaction (e.g., #293)
- [ ] Verify browser tab shows: "809 - Block C 8 (201) - May Moussa"
- [ ] Verify page title shows: "Receipt"
- [ ] Test with different apartments and owners
- [ ] Test with non-apartment transaction (browser tab should show number only)
- [ ] Print receipt and verify it looks professional
- [ ] Test with long owner names in browser tab
- [ ] Open multiple receipts and verify tabs are distinguishable

## Notes

- Browser tab title (HTML `<title>` tag) includes full details
- Visible page title remains "Receipt" for clean, professional appearance
- Format maintains consistency with other parts of the system
- Gracefully handles missing data (apartment or owner)
- No changes to receipt layout or printing
- Improves multi-tab workflow for administrators

