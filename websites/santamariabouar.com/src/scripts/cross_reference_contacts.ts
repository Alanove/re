import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import db from '../config/database';

interface GoogleContact {
  'First Name': string;
  'Middle Name': string;
  'Last Name': string;
  'Phone 1 - Value': string;
  'Phone 2 - Value': string;
  [key: string]: string;
}

interface ApartmentMatch {
  owner_name: string;
  owner_phone: string;
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-numeric characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle 00 prefix -> treat as +
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }
  
  // Handle Lebanese country code
  if (digits.startsWith('961')) {
    digits = digits.substring(3);
  }
  
  // Now we have the "local" part or international part without 00/+
  
  // If it's a Lebanese number starting with 0 (e.g. 03, 70, 71, etc.)
  if (digits.length === 8 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  // Lebanese mobile numbers are now mostly 7 digits (3xxxxxx, 70xxxxx, etc.)
  // Actually 70, 71, 76 etc are 2 digits + 6 digits = 8 digits total.
  // 03 is 2 digits + 6 digits = 8 digits total.
  // If I remove leading 0:
  // 03 123 456 -> 3123456 (7 digits)
  // 70 123 456 -> 70123456 (8 digits) - Wait, 70 is not 070. It's just 70.
  // So 70xxxxxx is 8 digits. 03xxxxxx is 8 digits.
  
  // Let's keep it simple: 
  // If it's 8 digits and starts with 03, remove the 0.
  if (digits.length === 8 && digits.startsWith('03')) {
    digits = digits.substring(1);
  }
  // If it's 8 digits and starts with 70, 71, 76, 78, 79, 81, keep it as is.
  
  return digits;
}

async function run() {
  console.log('🚀 Starting cross-reference script...');

  const docsDir = path.join(process.cwd(), 'docs', 'Main Entrance Contacts');
  const contactsPath = path.join(docsDir, 'contacts.csv');
  const googleContactsPath = path.join(docsDir, 'contacts-google.csv');
  const outputPath = path.join(docsDir, 'cross_referenced_contacts.csv');

  if (!fs.existsSync(contactsPath)) {
    console.error(`❌ contacts.csv not found at ${contactsPath}`);
    return;
  }

  // 1. Load contacts.csv
  const contactsRaw = fs.readFileSync(contactsPath, 'utf8');
  const contactsRecords = parse(contactsRaw, { columns: true, skip_empty_lines: true });
  const targetNumbers = contactsRecords.map((r: any) => r.number);
  
  console.log(`✅ Loaded ${targetNumbers.length} numbers from contacts.csv`);

  // 2. Load Google Contacts
  let googleMap = new Map<string, string>();
  if (fs.existsSync(googleContactsPath)) {
    const googleRaw = fs.readFileSync(googleContactsPath, 'utf8');
    const googleRecords = parse(googleRaw, { columns: true, skip_empty_lines: true }) as GoogleContact[];
    
    for (const record of googleRecords) {
      const name = [record['First Name'], record['Middle Name'], record['Last Name']].filter(Boolean).join(' ');
      const org = record['Organization Name'] || '';
      const fullName = org ? `${name} (${org})` : name;
      
      const phones = [record['Phone 1 - Value'], record['Phone 2 - Value']];
      for (const p of phones) {
        if (!p) continue;
        const subPhones = p.split(':::');
        for (const sp of subPhones) {
          const norm = normalizePhone(sp);
          if (norm) {
            const existing = googleMap.get(norm);
            if (existing && !existing.includes(fullName)) {
              googleMap.set(norm, `${existing} / ${fullName}`);
            } else {
              googleMap.set(norm, fullName);
            }
          }
        }
      }
    }
    console.log(`✅ Loaded ${googleMap.size} unique normalized numbers from Google Contacts`);
  }

  // 3. Load DB Contacts (Apartments & Users)
  let dbMap = new Map<string, string>();
  try {
    // Check Apartments
    const [aptRows] = await db.query('SELECT owner_name, owner_phone FROM apartments');
    for (const row of aptRows as ApartmentMatch[]) {
      if (!row.owner_phone) continue;
      const norm = normalizePhone(row.owner_phone);
      if (norm) {
        const existing = dbMap.get(norm);
        if (existing && !existing.includes(row.owner_name)) {
          dbMap.set(norm, `${existing} / ${row.owner_name}`);
        } else {
          dbMap.set(norm, row.owner_name);
        }
      }
    }

    // Check Users (maybe notes or email contain clues, but let's stick to name fields if any)
    // The schema shows no phone in users, but let's check if there's any other table.
    // The user mentioned "table users", maybe they have a custom field or I should check notes.
    const [userRows] = await db.query('SELECT username, notes FROM users');
    for (const row of userRows as any[]) {
      if (row.notes) {
        // Extract numbers from notes if any
        const foundNumbers = row.notes.match(/\+?\d[\d\s-]{6,}\d/g);
        if (foundNumbers) {
          for (const fn of foundNumbers) {
            const norm = normalizePhone(fn);
            if (norm) {
              const existing = dbMap.get(norm);
              if (existing && !existing.includes(row.username)) {
                dbMap.set(norm, `${existing} / ${row.username}`);
              } else {
                dbMap.set(norm, row.username);
              }
            }
          }
        }
      }
    }

    console.log(`✅ Loaded ${dbMap.size} unique normalized numbers from database (apartments + users notes)`);
  } catch (err) {
    console.error('❌ Failed to fetch from database:', err);
  }

  // 4. Cross-reference
  const results = [];
  for (const original of targetNumbers) {
    const norm = normalizePhone(original);
    const googleName = googleMap.get(norm) || '';
    const dbName = dbMap.get(norm) || '';
    
    results.push({
      'Original Number': original,
      'Normalized Number': norm,
      'Google Contact Name': googleName,
      'DB Match': dbName,
      'Found': (googleName || dbName) ? 'Yes' : 'No'
    });
  }

  // 5. Save Output
  const header = 'Original Number,Normalized Number,Google Contact Name,DB Match,Found\n';
  const csvContent = results.map(r => {
    return `"${r['Original Number']}","${r['Normalized Number']}","${r['Google Contact Name'].replace(/"/g, '""')}","${r['DB Match'].replace(/"/g, '""')}","${r['Found']}"`;
  }).join('\n');

  fs.writeFileSync(outputPath, header + csvContent);
  console.log(`✨ Success! Results saved to ${outputPath}`);
  
  await db.close();
}

run().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
