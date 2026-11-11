import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { TransactionsService, Transaction } from '../services/transactionsService';
import { TransactionCategoriesService, TransactionCategory } from '../services/transactionCategoriesService';
import { AccountsService, Account } from '../services/accountsService';

interface CSVRow {
  Date: string;
  Description: string;
  Category: string;
  Amount: string;
  Type: string;
  Account: string;
  Currency?: string;
}

class TransactionCSVImporter {
  private transactionsService: TransactionsService;
  private categoriesService: TransactionCategoriesService;
  private accountsService: AccountsService;
  
  // Maps to track what we've created
  private categoryNameToId: Map<string, number> = new Map();
  private accountNameToId: Map<string, number> = new Map();
  private importedTransactions: Transaction[] = [];

  constructor() {
    this.transactionsService = TransactionsService.getInstance();
    this.categoriesService = TransactionCategoriesService.getInstance();
    this.accountsService = AccountsService.getInstance();
  }

  /**
   * Import transactions from CSV file
   */
  public async importFromCSV(csvFilePath: string): Promise<void> {
    console.log('Starting CSV import...');
    
    // Read and parse CSV, removing BOM if present
    let csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    // Remove BOM (Byte Order Mark) if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    const records: CSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: false,
      trim: true,
      relax_column_count: true,
      bom: true
    });

    console.log(`Found ${records.length} records in CSV`);

    // Filter out empty rows - check if essential fields have values
    const validRecords = records.filter(record => {
      const hasDate = record.Date && typeof record.Date === 'string' && record.Date.trim() !== '';
      const hasCategory = record.Category && typeof record.Category === 'string' && record.Category.trim() !== '';
      const hasAmount = record.Amount && typeof record.Amount === 'string' && record.Amount.trim() !== '';
      const hasAccount = record.Account && typeof record.Account === 'string' && record.Account.trim() !== '';
      return hasDate && hasCategory && hasAmount && hasAccount;
    });

    console.log(`Processing ${validRecords.length} valid records`);

    // Step 1: Load existing categories and accounts
    await this.loadExistingCategoriesAndAccounts();

    // Step 2: Create missing categories from records
    await this.createCategoriesFromRecords(validRecords);

    // Step 3: Create missing accounts from records
    await this.createAccountsFromRecords(validRecords);

    // Step 4: Create transactions
    await this.createTransactionsFromRecords(validRecords);

    console.log('\n=== Import Summary ===');
    console.log(`Categories in system: ${this.categoryNameToId.size}`);
    console.log(`Accounts in system: ${this.accountNameToId.size}`);
    console.log(`Transactions imported: ${this.importedTransactions.length}`);
    console.log('Import completed successfully!');
  }

  /**
   * Load existing categories and accounts
   */
  private async loadExistingCategoriesAndAccounts(): Promise<void> {
    console.log('\nStep 1: Loading existing categories and accounts...');
    
    // Load categories
    const categories = await this.categoriesService.getAllCategories();
    for (const category of categories) {
      this.categoryNameToId.set(category.name, category.id);
      console.log(`  Loaded category: ${category.name} (ID: ${category.id})`);
    }

    // Load accounts
    const accounts = await this.accountsService.getAllAccounts();
    for (const account of accounts) {
      this.accountNameToId.set(account.name, account.id);
      console.log(`  Loaded account: ${account.name} (ID: ${account.id})`);
    }
  }

  /**
   * Create categories from unique category names in CSV
   */
  private async createCategoriesFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 2: Creating missing categories...');
    
    // Get unique category names
    const uniqueCategories = [...new Set(records.map(r => r.Category.trim()))];
    
    let createdCount = 0;
    for (const categoryName of uniqueCategories) {
      try {
        // Check if category already exists
        if (this.categoryNameToId.has(categoryName)) {
          console.log(`  Category already exists: ${categoryName}`);
          continue;
        }
        
        // Determine category type based on common patterns
        // "Income" type becomes "Expense" in the transactions
        const type = this.determineCategoryType(categoryName);
        const color = this.generateRandomColor();
        
        // Create new category
        const newCategory = await this.categoriesService.createCategory({
          name: categoryName,
          type: type,
          color: color,
          isActive: true
        });
        
        this.categoryNameToId.set(categoryName, newCategory.id);
        console.log(`  Created category: ${categoryName} (ID: ${newCategory.id}, Type: ${type})`);
        createdCount++;
      } catch (error) {
        console.error(`  Error creating category ${categoryName}:`, error);
      }
    }
    
    console.log(`  Created ${createdCount} new categories`);
  }

  /**
   * Create accounts from unique account names in CSV
   */
  private async createAccountsFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 3: Creating missing accounts...');
    
    // Get unique account names
    const uniqueAccounts = [...new Set(records.map(r => r.Account.trim()))];
    
    let createdCount = 0;
    for (const accountName of uniqueAccounts) {
      try {
        // Check if account already exists
        if (this.accountNameToId.has(accountName)) {
          console.log(`  Account already exists: ${accountName}`);
          continue;
        }
        
        // Create new account
        const newAccount = await this.accountsService.createAccount({
          name: accountName,
          userId: null,
          currency: 'USD',
          isActive: true,
          notes: 'Imported from CSV'
        });
        
        this.accountNameToId.set(accountName, newAccount.id);
        console.log(`  Created account: ${accountName} (ID: ${newAccount.id})`);
        createdCount++;
      } catch (error) {
        console.error(`  Error creating account ${accountName}:`, error);
      }
    }
    
    console.log(`  Created ${createdCount} new accounts`);
  }

  /**
   * Create transactions from CSV records
   */
  private async createTransactionsFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 4: Creating transactions...');
    
    const allTransactions = await this.transactionsService.getAllTransactions();
    let nextId = allTransactions.length > 0 ? Math.max(...allTransactions.map(t => t.id)) + 1 : 1;
    
    for (const record of records) {
      try {
        // Parse date
        const transactionDate = this.parseDate(record.Date);
        
        // Get category ID
        const categoryId = this.categoryNameToId.get(record.Category.trim());
        if (!categoryId) {
          console.error(`  Skipping transaction - category not found: ${record.Category}`);
          continue;
        }

        // Get account ID
        const accountId = this.accountNameToId.get(record.Account.trim());
        if (!accountId) {
          console.error(`  Skipping transaction - account not found: ${record.Account}`);
          continue;
        }

        // Parse amount (handle negative amounts)
        const amount = Math.abs(parseFloat(record.Amount));
        if (isNaN(amount)) {
          console.error(`  Skipping transaction - invalid amount: ${record.Amount}`);
          continue;
        }

        // Determine transaction type: Use the Type from CSV as-is
        // "Income" in CSV = income in system (money coming in, like Common Expenses payments)
        // "Expenses" in CSV = expense in system (money going out, like Electricity bills)
        const type: 'income' | 'expense' = record.Type.trim().toLowerCase() === 'income' ? 'income' : 'expense';

        // Create transaction
        const newTransaction: Transaction = {
          id: nextId++,
          amount: amount,
          type: type,
          categoryId: categoryId,
          description: record.Description?.trim() || '',
          date: transactionDate,
          accountId: accountId,
          receiptGenerated: false,
          createdAt: new Date().toISOString(),
          createdBy: 1 // Default admin user
        };

        this.importedTransactions.push(newTransaction);
        
        console.log(`  Created transaction: ${record.Date} - ${record.Description} - ${record.Category} - $${amount} (${type})`);
      } catch (error) {
        console.error(`  Error creating transaction:`, error, record);
      }
    }

    // Save all transactions at once
    await this.saveTransactions([...allTransactions, ...this.importedTransactions]);
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): string {
    try {
      // Handle formats like "2/1/2025", "1-Feb", etc.
      let date: Date;
      
      // Try M/D/YYYY format
      if (dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      // Try D-MMM format (assume current year 2025)
      else if (dateStr.includes('-')) {
        const [day, monthStr] = dateStr.split('-');
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const month = monthMap[monthStr];
        if (month === undefined) {
          throw new Error(`Invalid month: ${monthStr}`);
        }
        date = new Date(2025, month, parseInt(day));
      }
      else {
        throw new Error(`Unrecognized date format: ${dateStr}`);
      }
      
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error(`Error parsing date: ${dateStr}`, error);
      return new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Determine category type based on name patterns
   */
  private determineCategoryType(categoryName: string): 'income' | 'expense' | 'both' {
    const lowerName = categoryName.toLowerCase();
    
    // Common income categories
    if (lowerName.includes('income') || 
        lowerName.includes('common expenses') || 
        lowerName.includes('contribution') ||
        lowerName.includes('2024')) {
      return 'income';
    }
    
    // Transfer is both
    if (lowerName.includes('transfer')) {
      return 'both';
    }
    
    // Default to expense
    return 'expense';
  }

  /**
   * Generate a random color for categories
   */
  private generateRandomColor(): string {
    const colors = [
      '#3498db', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c',
      '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad',
      '#2c3e50', '#d35400', '#c0392b', '#7f8c8d', '#95a5a6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Save transactions data
   */
  private async saveTransactions(transactions: Transaction[]): Promise<void> {
    const dataPath = path.join(__dirname, '../../data/transactions.json');
    
    const data = {
      transactions: transactions
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`\n  Saved ${transactions.length} transactions to transactions.json`);
  }
}

// Run the importer
async function main() {
  const csvPath = path.join(__dirname, '../../docs/transactions.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const importer = new TransactionCSVImporter();
  
  try {
    await importer.importFromCSV(csvPath);
    console.log('\n✓ Import completed successfully!');
  } catch (error) {
    console.error('\n✗ Import failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { TransactionCSVImporter };

