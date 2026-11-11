/**
 * Import Old Electricity Bills from Excel into unified invoices
 *
 * - Reads: docs/Santa Maria - Electricity Fees - 2020 to 2023.xlsx
 * - For each row:
 *   - Column 1: "Block - unofficial / official" (e.g. "J - 102 / 5")
 *   - Last non-empty column: total amount
 * - Creates an invoice per apartment:
 *   - category: "Old Electricity Bills"
 *   - year: 2026
 *   - invoiceDate: 2026-01-01
 *   - dueDate: null
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import { db } from '../src/config/database';
import { ApartmentsService } from '../admin/services/apartmentsService';
import { InvoicesService } from '../admin/services/invoicesService';

interface ExcelRowData {
  rawLabel: string;
  block: string;
  unofficialNumber: string;
  officialNumber: string;
  total: number;
  rowIndex: number;
}

const DRY_RUN = false; // Set to false to actually create invoices

const INVOICE_YEAR = 2026;
const INVOICE_DATE = '2026-01-01';
const EXCEL_RELATIVE_PATH = path.join(
  'docs',
  'Santa Maria - Electricity Fees - 2020 to 2023.xlsx'
);

async function getOldElectricityBillsCategoryId(): Promise<number> {
  const [rows] = await db.query(
    `
      SELECT id 
      FROM transaction_categories 
      WHERE LOWER(name) = 'old electricity bills'
      LIMIT 1
    `
  );

  const resultRows = rows as any[];
  if (!resultRows.length) {
    throw new Error("Category 'Old Electricity Bills' not found in transaction_categories");
  }

  return parseInt(String(resultRows[0].id), 10);
}

function parseApartmentLabel(label: string, rowIndex: number): ExcelRowData | null {
  const trimmed = (label || '').trim();
  if (!trimmed) {
    return null;
  }

  // Expect format like: "J - 102 / 5"
  const regex = /^([A-Ja-j])\s*-\s*(\d+)\s*\/\s*(\d+)\s*$/;
  const match = trimmed.match(regex);
  if (!match) {
    // Likely a header or invalid row
    return null;
  }

  const block = match[1].toUpperCase();
  const unofficialNumber = match[2];
  const officialNumber = match[3];

  return {
    rawLabel: trimmed,
    block,
    unofficialNumber,
    officialNumber,
    total: 0, // filled later
    rowIndex
  };
}

function loadExcelRows(): ExcelRowData[] {
  const workbookPath = path.join(__dirname, '..', EXCEL_RELATIVE_PATH);
  console.log(`Reading Excel file from: ${workbookPath}`);

  const workbook = XLSX.readFile(workbookPath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const sheetJson = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false
  }) as any[][];

  const rows: ExcelRowData[] = [];

  sheetJson.forEach((row, index) => {
    const rowIndex = index + 1; // 1-based for Excel-like reporting
    if (!row || row.length === 0) {
      return;
    }

    const firstCell = row[0];
    const parsed = parseApartmentLabel(String(firstCell || ''), rowIndex);
    if (!parsed) {
      // skip headers or invalid rows
      return;
    }

    // Find last non-empty cell as total
    let lastValue: any = null;
    for (let i = row.length - 1; i >= 0; i--) {
      const value = row[i];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        lastValue = value;
        break;
      }
    }

    if (lastValue === null) {
      console.warn(
        `Row ${rowIndex}: parsed label "${parsed.rawLabel}" but no total found, skipping`
      );
      return;
    }

    const total = Number(lastValue);
    if (!Number.isFinite(total) || total <= 0) {
      console.warn(
        `Row ${rowIndex}: invalid or non-positive total "${lastValue}" for "${parsed.rawLabel}", skipping`
      );
      return;
    }

    rows.push({
      ...parsed,
      total
    });
  });

  console.log(`Parsed ${rows.length} valid data rows from Excel`);
  return rows;
}

async function buildApartmentLookup(apartmentsService: ApartmentsService) {
  const apartments = await apartmentsService.getAllApartments();
  console.log(`Loaded ${apartments.length} apartments from database`);

  const byBlockAndOfficial: Record<string, any> = {};

  for (const apt of apartments) {
    const key = `${apt.block}|${String(apt.unitNumberOfficial).trim()}`;
    if (byBlockAndOfficial[key]) {
      console.warn(
        `Duplicate apartment for key ${key}: IDs ${byBlockAndOfficial[key].id} and ${apt.id}`
      );
    }
    byBlockAndOfficial[key] = apt;
  }

  return byBlockAndOfficial;
}

async function main() {
  try {
    console.log('🚀 Starting Old Electricity Bills import (from Excel)...');

    await db.testConnection();
    console.log('✅ Database connection OK');

    const apartmentsService = ApartmentsService.getInstance();
    const invoicesService = InvoicesService.getInstance();

    const categoryId = await getOldElectricityBillsCategoryId();
    console.log(`Using categoryId ${categoryId} for 'Old Electricity Bills'`);

    const apartmentLookup = await buildApartmentLookup(apartmentsService);
    const rows = loadExcelRows();

    let createdCount = 0;
    let skippedMissingApartment = 0;
    let skippedInvalid = 0;

    for (const row of rows) {
      const key = `${row.block}|${row.officialNumber}`;
      const apartment = apartmentLookup[key];

      if (!apartment) {
        console.warn(
          `Row ${row.rowIndex}: no apartment found for Block ${row.block}, official ${row.officialNumber} (label "${row.rawLabel}"), total=${row.total}`
        );
        skippedMissingApartment++;
        continue;
      }

      // Optional: verify unofficial number if present
      const dbUnofficial = apartment.unitNumberUnofficial
        ? String(apartment.unitNumberUnofficial).trim()
        : '';
      if (dbUnofficial && dbUnofficial !== row.unofficialNumber) {
        console.warn(
          `Row ${row.rowIndex}: unofficial mismatch for apartment ID ${apartment.id} - Excel=${row.unofficialNumber}, DB=${dbUnofficial} (continuing anyway)`
        );
      }

      const description = `Old Electricity Bills 2020–2023 - Block ${row.block} ${row.officialNumber} (${row.unofficialNumber})`;
      const notes =
        'Imported from docs/Santa Maria - Electricity Fees - 2020 to 2023.xlsx';

      console.log(
        `${DRY_RUN ? '[DRY RUN] ' : ''}Preparing invoice for apartment ID ${
          apartment.id
        } (Block ${row.block}, official ${row.officialNumber}, unofficial ${
          row.unofficialNumber
        }): amount=${row.total.toFixed(2)}`
      );

      if (DRY_RUN) {
        continue;
      }

      try {
        await invoicesService.createInvoice({
          apartmentId: apartment.id,
          categoryId,
          amount: row.total,
          description,
          dueDate: null,
          invoiceDate: INVOICE_DATE,
          year: INVOICE_YEAR,
          notes,
          createdBy: null
        });
        createdCount++;
      } catch (error) {
        console.error(
          `Error creating invoice for apartment ID ${apartment.id} (row ${row.rowIndex}):`,
          error
        );
        skippedInvalid++;
      }
    }

    console.log('\n📊 Import summary:');
    console.log(`  Total Excel rows processed: ${rows.length}`);
    console.log(`  Invoices created: ${createdCount}`);
    console.log(`  Skipped (missing apartment): ${skippedMissingApartment}`);
    console.log(`  Skipped (errors during create): ${skippedInvalid}`);
    console.log(`  DRY_RUN mode: ${DRY_RUN ? 'ON (no invoices written)' : 'OFF (changes applied)'}`);
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exitCode = 1;
  } finally {
    await db.close();
    console.log('Database connection closed.');
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

