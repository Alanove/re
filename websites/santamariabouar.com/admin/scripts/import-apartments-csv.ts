import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { UsersService } from '../services/usersService';
import { ApartmentsService } from '../services/apartmentsService';
import { ApartmentPaymentsService } from '../services/apartmentPaymentsService';

interface CSVRow {
  Name: string;
  Block: string;
  Unit: string;
  'Unit (Official)': string;
  Area: string;
  Year: string;
  'Due Ammount ($)': string;
  'Paid ($)': string;
  Balance: string;
}

class ApartmentCSVImporter {
  private usersService: UsersService;
  private apartmentsService: ApartmentsService;
  private apartmentPaymentsService: ApartmentPaymentsService;
  
  // Maps to track what we've created
  private userNameToId: Map<string, number> = new Map();
  private apartmentKeyToId: Map<string, number> = new Map();
  private apartmentIdToTempPayments: Map<number, number> = new Map();

  constructor() {
    this.usersService = new UsersService();
    this.apartmentsService = ApartmentsService.getInstance();
    this.apartmentPaymentsService = ApartmentPaymentsService.getInstance();
  }

  /**
   * Import apartments from CSV file
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

    // Filter out empty rows - check if Name and Block have actual values
    const validRecords = records.filter(record => {
      const hasName = record.Name && typeof record.Name === 'string' && record.Name.trim() !== '';
      const hasBlock = record.Block && typeof record.Block === 'string' && record.Block.trim() !== '';
      return hasName && hasBlock;
    });

    console.log(`Processing ${validRecords.length} valid records`);

    // Step 1: Create users from unique names
    await this.createUsersFromRecords(validRecords);

    // Step 2: Create apartments (unique by owner + block + unit)
    await this.createApartmentsFromRecords(validRecords);

    // Step 3: Create apartment payments
    await this.createPaymentsFromRecords(validRecords);

    console.log('\n=== Import Summary ===');
    console.log(`Users created: ${this.userNameToId.size}`);
    console.log(`Apartments created: ${this.apartmentKeyToId.size}`);
    console.log(`Payments processed: ${validRecords.length}`);
    console.log('Import completed successfully!');
  }

  /**
   * Create users from unique names in CSV
   */
  private async createUsersFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 1: Creating users...');
    
    // Get unique names
    const uniqueNames = [...new Set(records.map(r => r.Name.trim()))];
    
    for (const name of uniqueNames) {
      try {
        // Check if user already exists
        const existingUsers = this.usersService.getAllUsers();
        const existingUser = existingUsers.find(u => u.name === name);
        
        if (existingUser) {
          console.log(`  User already exists: ${name} (ID: ${existingUser.id})`);
          this.userNameToId.set(name, existingUser.id);
        } else {
          // Create new user as Member (apartment owner)
          const newUser = this.usersService.createUser({
            name: name,
            status: 'Active',
            role: 'Member',
            notes: 'Imported from CSV'
          });
          
          this.userNameToId.set(name, newUser.id);
          console.log(`  Created user: ${name} (ID: ${newUser.id})`);
        }
      } catch (error) {
        console.error(`  Error creating user ${name}:`, error);
      }
    }
  }

  /**
   * Create apartments from CSV records
   */
  private async createApartmentsFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 2: Creating apartments...');
    
    // Group records by unique apartment (owner + block + unit)
    const apartmentMap = new Map<string, CSVRow>();
    
    for (const record of records) {
      const key = `${record.Name.trim()}-${record.Block.trim()}-${record.Unit.trim()}`;
      
      // Use the first occurrence of this apartment (should have most complete data)
      if (!apartmentMap.has(key)) {
        apartmentMap.set(key, record);
      }
    }

    console.log(`Found ${apartmentMap.size} unique apartments`);

    // Create apartments
    for (const [key, record] of apartmentMap.entries()) {
      try {
        const ownerId = this.userNameToId.get(record.Name.trim());
        
        if (!ownerId) {
          console.error(`  Skipping apartment - owner not found: ${record.Name}`);
          continue;
        }

        // Check if apartment already exists
        const existingApartments = this.apartmentsService.getAllApartments();
        const existingApartment = existingApartments.find(apt => 
          apt.ownerId === ownerId &&
          apt.block === record.Block.trim() &&
          apt.unitNumberUnofficial === record.Unit.trim()
        );

        if (existingApartment) {
          console.log(`  Apartment already exists: ${key} (ID: ${existingApartment.id})`);
          this.apartmentKeyToId.set(key, existingApartment.id);
        } else {
          // Parse area
          const area = parseFloat(record.Area) || 0;
          
          // Create apartment
          const newApartment = this.apartmentsService.addApartment({
            ownerId: ownerId,
            block: record.Block.trim() as any,
            unitNumberUnofficial: record.Unit.trim(),
            unitNumberOfficial: record['Unit (Official)']?.trim() || record.Unit.trim(),
            areaInM2: area,
            status: 'owned',
            registrationDate: new Date().toISOString(), // Use current date as registration
            officialImage: '',
            images: [],
            notes: 'Imported from CSV'
          });
          
          this.apartmentKeyToId.set(key, newApartment.id);
          console.log(`  Created apartment: ${key} (ID: ${newApartment.id}, Area: ${area}m²)`);
        }
      } catch (error) {
        console.error(`  Error creating apartment ${key}:`, error);
      }
    }
  }

  /**
   * Create apartment payments from CSV records
   */
  private async createPaymentsFromRecords(records: CSVRow[]): Promise<void> {
    console.log('\nStep 3: Creating apartment payments...');
    
    // Initialize the payments array
    const allPayments: any[] = [];
    let nextId = 1;

    for (const record of records) {
      try {
        // Skip incomplete records
        if (!record.Year || !record['Due Ammount ($)']) {
          console.log(`  Skipping incomplete payment record for ${record.Name}`);
          continue;
        }

        const key = `${record.Name.trim()}-${record.Block.trim()}-${record.Unit.trim()}`;
        const apartmentId = this.apartmentKeyToId.get(key);
        
        if (!apartmentId) {
          console.error(`  Skipping payment - apartment not found: ${key}`);
          continue;
        }

        const year = parseInt(record.Year);
        const dueAmount = parseFloat(record['Due Ammount ($)']) || 0;
        const paidAmount = parseFloat(record['Paid ($)']) || 0;
        const balance = parseFloat(record.Balance) || 0;
        const area = parseFloat(record.Area) || 0;

        // Calculate price per m²
        const pricePerM2 = area > 0 ? dueAmount / area : 0;

        // Handle 2026 or future year payments as temp payments
        if (year >= 2026) {
          console.log(`  Creating temp payment for ${key} - Year ${year} (Future payment): $${paidAmount}`);
          
          if (paidAmount > 0) {
            // Add to temp payments accumulator
            const currentTemp = this.apartmentIdToTempPayments.get(apartmentId) || 0;
            this.apartmentIdToTempPayments.set(apartmentId, currentTemp + paidAmount);
          }
          continue;
        }

        // Check if payment already exists for this apartment and year
        const existingPayment = allPayments.find(p => 
          p.apartmentId === apartmentId && p.year === year
        );

        if (existingPayment) {
          console.log(`  Payment already exists for ${key} - Year ${year}, updating amount`);
          existingPayment.amountPaid = paidAmount;
          existingPayment.updatedAt = new Date().toISOString();
        } else {
          // Create new payment
          const newPayment = {
            id: nextId++,
            apartmentId: apartmentId,
            year: year,
            startDate: new Date(`${year}-01-01`).toISOString(),
            areaInM2: area,
            pricePerM2: pricePerM2,
            totalAmount: dueAmount,
            amountPaid: paidAmount,
            createdAt: new Date().toISOString()
          };

          allPayments.push(newPayment);
          
          console.log(`  Created payment for ${key} - Year ${year}: Due $${dueAmount}, Paid $${paidAmount}, Balance $${balance}`);
        }

        // Handle positive balance (overpayment) - add to temp payments
        if (balance > 0) {
          console.log(`  Overpayment detected for ${key}: $${balance} - adding to temp payments`);
          
          const currentTemp = this.apartmentIdToTempPayments.get(apartmentId) || 0;
          this.apartmentIdToTempPayments.set(apartmentId, currentTemp + balance);
        }

      } catch (error) {
        console.error(`  Error creating payment for ${record.Name}:`, error);
      }
    }

    // Create temp payments for apartments with overpayments or future payments
    console.log('\nStep 4: Creating temp payments for overpayments and future payments...');
    for (const [apartmentId, amount] of this.apartmentIdToTempPayments.entries()) {
      if (amount > 0) {
        const apartment = this.apartmentsService.getApartmentById(apartmentId);
        const owner = apartment ? this.usersService.getUserById(apartment.ownerId) : null;
        const ownerName = owner ? owner.name : `ID ${apartmentId}`;
        
        console.log(`  Creating temp payment for apartment ${ownerName}: $${amount.toFixed(2)}`);
        
        // Add temp payment (year = 0)
        allPayments.push({
          id: nextId++,
          apartmentId: apartmentId,
          year: 0, // 0 indicates temp payment
          startDate: new Date().toISOString(),
          areaInM2: 0,
          pricePerM2: 0,
          totalAmount: amount,
          amountPaid: amount,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Save all payments at once
    this.saveApartmentPayments(allPayments);
  }

  /**
   * Save apartment payments data
   */
  private saveApartmentPayments(payments: any[]): void {
    const dataPath = path.join(__dirname, '../../data/apartment-payments.json');
    
    const data = {
      apartmentPayments: payments
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`\n  Saved ${payments.length} payments to apartment-payments.json`);
  }
}

// Run the importer
async function main() {
  const csvPath = path.join(__dirname, '../../docs/apartments.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const importer = new ApartmentCSVImporter();
  
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

export { ApartmentCSVImporter };

