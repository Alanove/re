# Apartment CSV Import Script

## Overview
This script imports apartment data from a CSV file (`docs/apartments.csv`) into the Santa Maria Bouar CMS system.

## What It Does

### 1. Creates Users
- Extracts unique owner names from the CSV
- Creates user accounts with role "Member" (apartment owners)
- Skips users that already exist in the system

### 2. Creates Apartments
- Creates apartment records for each unique combination of owner + block + unit
- Maps CSV columns as follows:
  - `Name` → User (apartment owner)
  - `Block` → Block (A-J)
  - `Unit` → Unit Number (Unofficial)
  - `Unit (Official)` → Unit Number (Official)
  - `Area` → Area in m²
  - Status → Set to "owned"

### 3. Creates Apartment Payments
- Creates payment records for each year in the CSV
- Maps CSV columns as follows:
  - `Year` → Payment year
  - `Due Ammount ($)` → Total amount due
  - `Paid ($)` → Amount paid
  - `Balance` → Calculated difference

### 4. Handles Special Cases

#### Overpayments (Positive Balance)
When a payment has a positive balance (paid more than due), the extra amount is stored as a "temp payment" with year = 0. This can be applied to future years.

**Example:** Elie Abou Hamad paid $672 but owed $668 → $4 stored as temp payment

#### Future Year Payments (2026+)
Payments for year 2026 or later are automatically converted to temp payments (year = 0) for future use.

**Example:** Alfred Eid paid $408 for 2026 → $408 stored as temp payment

#### Multiple Years for Same Apartment
The script handles apartments with payments across multiple years (e.g., 2022, 2023, 2024, 2025)

## Usage

### Run the Import
```bash
npm run import-apartments
```

### Import Results
The script will output:
- Number of users created
- Number of apartments created
- Number of payments processed
- Details of overpayments converted to temp payments

## Data Files Updated

- `data/users.json` - User accounts (apartment owners)
- `data/apartments.json` - Apartment records
- `data/apartment-payments.json` - Payment records including:
  - Regular payments (year > 0)
  - Temp payments (year = 0) for overpayments and future payments

## Import Statistics (Last Run)

- **Users Created:** 92 apartment owners
- **Apartments Created:** 96 units across blocks A-J
- **Payments Processed:** 128 payment records
- **Total Records Saved:** 136 (including 10 temp payments)

## Temp Payments Summary

The following apartments have temp payment credits:
1. Elie Abou Hamad - $4.00
2. Chadi Bou Abboud - $2.00
3. Noura Ohannessian - $2.00
4. Joseph Abi Kheirs- ROULA HAJJAR - $2.00
5. Randa Chidiac - $38.00
6. Sabine Kassouf - $1.00
7. Camile Chidiac - $3.00
8. Gemayel Armale - $10.00
9. Mostafa Itani - $2.00
10. Alfred Eid - $408.00 (2026 payment)

**Total Temp Payment Credits:** $472.00

## Notes

- The script is idempotent: running it multiple times won't create duplicates
- Existing users, apartments, and payments are detected and skipped
- The CSV file must have the standard column headers
- Empty rows in the CSV are automatically filtered out
- The script handles BOM (Byte Order Mark) in CSV files

## Troubleshooting

If the import fails:
1. Check that `docs/apartments.csv` exists
2. Verify the CSV has the correct columns
3. Ensure no file locks on the data files
4. Check the console output for specific error messages


