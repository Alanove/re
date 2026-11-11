# Transaction CSV Import Script

This script imports transactions from a CSV file into the system.

## CSV Format

The CSV file should have the following columns:
- **Date**: Transaction date (formats: "2/1/2025" or "1-Feb")
- **Description**: Transaction description
- **Category**: Category name (will be created if it doesn't exist)
- **Amount**: Transaction amount (can be negative)
- **Type**: Transaction type - "Income" or "Expenses"
  - Note: "Income" in CSV becomes "expense" in the system
  - "Expenses" in CSV becomes "income" in the system
- **Account**: Account name (will be created if it doesn't exist)
- **Currency**: (Optional, ignored - all transactions are in USD)

## Mapping Rules

### Type Mapping
The CSV "Type" column is used as-is:
- CSV "Income" → System "income" (money coming in, e.g., Common Expenses payments from residents)
- CSV "Expenses" → System "expense" (money going out, e.g., Electricity bills, maintenance costs)

### Category Creation
- If a category doesn't exist, it will be created automatically
- Category type is determined based on the name:
  - "Common Expenses", "2024", "Contribution" → income category
  - "Transfer" → both (income and expense)
  - Everything else → expense category
- A random color is assigned to new categories

### Account Creation
- If an account doesn't exist, it will be created automatically
- All accounts use USD currency
- Accounts are marked as "Imported from CSV" in notes

### Date Parsing
The script handles two date formats:
1. `M/D/YYYY` format (e.g., "2/1/2025")
2. `D-MMM` format (e.g., "1-Feb") - assumes 2025 as the year

## Usage

### Prerequisites
Make sure the CSV file is located at: `docs/transactions.csv`

### Running the Script

#### Option 1: Using npx tsx (recommended)
```bash
npx tsx admin/scripts/import-transactions-csv.ts
```

#### Option 2: Using ts-node
```bash
ts-node admin/scripts/import-transactions-csv.ts
```

#### Option 3: Compile first, then run
```bash
tsc admin/scripts/import-transactions-csv.ts
node admin/scripts/import-transactions-csv.js
```

## What the Script Does

1. **Loads existing data**: Reads existing categories and accounts from the system
2. **Creates missing categories**: Any categories in the CSV that don't exist will be created
3. **Creates missing accounts**: Any accounts in the CSV that don't exist will be created
4. **Imports transactions**: Creates all valid transactions from the CSV file

## Output

The script will display:
- Number of records found in CSV
- Number of valid records to process
- Each category and account loaded/created
- Each transaction created
- Final summary with totals

Example output:
```
Starting CSV import...
Found 291 records in CSV
Processing 291 valid records

Step 1: Loading existing categories and accounts...
  Loaded category: George (ID: 1)
  Loaded category: Electricity (ID: 2)
  ...

Step 2: Creating missing categories...
  Category already exists: George
  Created category: Solar (ID: 10, Type: expense)
  Created 15 new categories

Step 3: Creating missing accounts...
  Account already exists: George
  Account already exists: Eddy
  Created 0 new accounts

Step 4: Creating transactions...
  Created transaction: 2/1/2025 - Passed Amount from 2024 - 2024 - $1365 (expense)
  Created transaction: 2/1/2025 - Passed Amount from 2024 - 2024 - $390 (expense)
  ...

  Saved 291 transactions to transactions.json

=== Import Summary ===
Categories in system: 25
Accounts in system: 4
Transactions imported: 291
Import completed successfully!

✓ Import completed successfully!
```

## Error Handling

The script will:
- Skip rows with missing essential fields (Date, Category, Amount, Account)
- Skip transactions with invalid amounts
- Skip transactions if category or account cannot be found/created
- Display error messages for any issues encountered
- Continue processing remaining records even if some fail

## Important Notes

1. **Backup**: It's recommended to backup your `data/transactions.json` file before running the import
2. **Duplicates**: The script does not check for duplicate transactions - running it multiple times will create duplicates
3. **User ID**: All imported transactions are assigned to user ID 1 (admin)
4. **Currency**: All transactions are imported with USD currency regardless of the CSV currency column

## Example CSV Row

```csv
Date,Description,Category,Amount,Type,Account,Currency
2/1/2025,Passed Amount from 2024,2024,1365,Income,Nadim,$
1-Feb,Electricity Bill - EDL,Electricity,-1316,Expenses,George,$
```

This will create:
- Transaction 1: $1365 income in "2024" category, Nadim account (money coming in)
- Transaction 2: $1316 expense in "Electricity" category, George account (money going out)

