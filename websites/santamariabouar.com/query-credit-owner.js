const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'sa', password: 'P@55w0rd', database: 'smb'
  });

  try {
    // Get all Credit - Owner transactions with full details
    const [txns] = await conn.query(`
      SELECT 
        t.id, t.type, t.amount, t.date, t.description, t.reference, t.notes,
        t.apartment_id, t.account_id, t.invoice_id,
        tc.name as category_name, tc.id as category_id,
        a.floor as block, a.apartment_number as unit,
        a.owner_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN apartments a ON t.apartment_id = a.id
      WHERE tc.name = 'Credit - Owner'
      ORDER BY t.date DESC
    `);
    
    console.log('=== Credit - Owner TRANSACTIONS (' + txns.length + ') ===');
    txns.forEach(t => {
      console.log(JSON.stringify({
        id: t.id,
        amount: t.amount,
        date: t.date,
        description: t.description,
        reference: t.reference,
        apartment_id: t.apartment_id,
        block: t.block,
        unit: t.unit,
        owner: t.owner_name,
        account_id: t.account_id,
        invoice_id: t.invoice_id
      }));
    });

    // Also get all distinct categories to understand the full picture
    const [allCats] = await conn.query("SELECT id, name, type FROM transaction_categories ORDER BY name");
    console.log('\n=== ALL CATEGORIES ===');
    allCats.forEach(c => console.log(`  id:${c.id} name:"${c.name}" type:${c.type}`));

  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
