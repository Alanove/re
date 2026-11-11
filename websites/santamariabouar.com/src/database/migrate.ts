import * as fs from 'fs';
import * as path from 'path';
import { db } from '../config/database';

interface MigrationResult {
  table: string;
  success: boolean;
  recordsInserted: number;
  error?: string;
}

class DataMigration {
  private dataPath = path.join(__dirname, '../../data');
  private results: MigrationResult[] = [];

  private readJSONFile(fileName: string): any {
    const filePath = path.join(this.dataPath, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName}`);
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async runSchema() {
    console.log('📋 Running database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Remove comments and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (err: any) {
        // Ignore "table already exists" errors
        if (!err.message.includes('already exists')) {
          console.error(`Schema error: ${err.message}`);
        }
      }
    }
    console.log('✅ Schema created successfully\n');
  }

  async migrateUsers() {
    console.log('👥 Migrating users...');
    const data = this.readJSONFile('users.json');
    const users = data.users || data;
    let inserted = 0;

    try {
      for (const user of users) {
        // Preserve original user IDs for apartment owner linking
        await db.query(
          `INSERT INTO users (id, username, password, salt, email, status, role, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id, // Preserve original ID
            user.name || user.username, 
            user.password || null, 
            user.salt || null, 
            user.email || null, 
            user.status || 'Active', 
            user.role || 'user',
            user.notes || null
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'users', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} users with original IDs\n`);
    } catch (err: any) {
      console.error('❌ Error migrating users:', err.message);
      this.results.push({ table: 'users', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateAccounts() {
    console.log('💰 Migrating accounts...');
    const data = this.readJSONFile('accounts.json');
    const accounts = data.accounts || data;
    let inserted = 0;

    try {
      for (const account of accounts) {
        await db.query(
          `INSERT INTO accounts (name, type, balance, currency, description, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            account.name,
            account.type || account.userId || 'general',
            account.balance || 0,
            account.currency || 'XAF',
            account.description || account.notes || '',
            account.isActive !== false ? 1 : 0
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'accounts', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} accounts\n`);
    } catch (err: any) {
      console.error('❌ Error migrating accounts:', err.message);
      this.results.push({ table: 'accounts', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateTransactionCategories() {
    console.log('📊 Migrating transaction categories...');
    const data = this.readJSONFile('transaction-categories.json');
    const categories = data.categories || data;
    let inserted = 0;

    try {
      for (const category of categories) {
        await db.query(
          `INSERT INTO transaction_categories (name, type, description, color, icon) VALUES (?, ?, ?, ?, ?)`,
          [
            category.name,
            category.type,
            category.description || '',
            category.color || '',
            category.icon || ''
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'transaction_categories', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} transaction categories\n`);
    } catch (err: any) {
      console.error('❌ Error migrating transaction categories:', err.message);
      this.results.push({ table: 'transaction_categories', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateTransactions() {
    console.log('💳 Migrating transactions...');
    const data = this.readJSONFile('transactions.json');
    const transactions = data.transactions || data;
    let inserted = 0;

    try {
      for (const transaction of transactions) {
        await db.query(
          `INSERT INTO transactions (account_id, category_id, amount, type, date, description, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transaction.accountId,
            transaction.categoryId,
            transaction.amount,
            transaction.type,
            transaction.date,
            transaction.description || '',
            transaction.reference || '',
            transaction.notes || ''
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'transactions', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} transactions\n`);
    } catch (err: any) {
      console.error('❌ Error migrating transactions:', err.message);
      this.results.push({ table: 'transactions', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateApartments() {
    console.log('🏢 Migrating apartments...');
    const data = this.readJSONFile('apartments.json');
    const apartments = data.apartments || data;
    let inserted = 0;

    try {
      for (const apt of apartments) {
        // Convert registration date from ISO to MySQL date format
        let regDate = null;
        if (apt.registrationDate) {
          regDate = apt.registrationDate.split('T')[0];
        }
        
        // Use block as the floor value, this is important for the compound unique key
        const floor = apt.block || apt.floor || '';
        const apartmentNumber = apt.unitNumberOfficial || apt.apartmentNumber || apt.unitNumberUnofficial;
        
        // Get owner details from users table
        let ownerName = `Owner ${apt.ownerId}`;
        let ownerEmail = '';
        if (apt.ownerId) {
          const [userRows] = await db.query('SELECT username, email FROM users WHERE id = ?', [apt.ownerId]);
          if (userRows && (userRows as any[]).length > 0) {
            const user = (userRows as any[])[0];
            ownerName = user.username;
            ownerEmail = user.email || '';
          }
        }
        
        await db.query(
          `INSERT INTO apartments (owner_id, apartment_number, apartment_number_unofficial, owner_name, owner_phone, owner_email, floor, size, bedrooms, bathrooms, registration_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            apt.ownerId || null,
            apartmentNumber,
            apt.unitNumberUnofficial || apartmentNumber,
            ownerName,
            apt.ownerPhone || '',
            ownerEmail,
            floor,
            apt.areaInM2 || apt.size || null,
            apt.bedrooms || null,
            apt.bathrooms || null,
            regDate,
            apt.status || 'active',
            apt.notes || ''
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'apartments', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} apartments with owner links\n`);
    } catch (err: any) {
      console.error('❌ Error migrating apartments:', err.message);
      console.error(`Last apartment attempted: ${apartments[inserted]?.unitNumberOfficial || 'unknown'}, inserted so far: ${inserted}`);
      this.results.push({ table: 'apartments', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migratePayments() {
    console.log('💵 Migrating payments...');
    const data = this.readJSONFile('payments.json');
    const payments = data.pricePerMeter || data.payments || data;
    let inserted = 0;

    try {
      // First, create a payment record for year 0 (Credit Adjustments)
      await db.query(
        `INSERT INTO payments (name, description, amount, year, payment_type) VALUES (?, ?, ?, ?, ?)`,
        [
          'Credit Adjustments',
          'Credit adjustments and prepayments',
          0,
          0,
          'credit_adjustment'
        ]
      );
      inserted++;
      console.log('✅ Created year 0 payment record for credit adjustments');

      // Now migrate the regular payments
      for (const payment of payments) {
        await db.query(
          `INSERT INTO payments (name, description, amount, year, due_date, payment_type) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            payment.name || `Price per meter ${payment.year}`,
            payment.description || '',
            payment.amount || payment.price,
            payment.year,
            payment.dueDate || null,
            payment.paymentType || 'price_per_meter'
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'payments', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} payments (including year 0)\n`);
    } catch (err: any) {
      console.error('❌ Error migrating payments:', err.message);
      this.results.push({ table: 'payments', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateApartmentPayments() {
    console.log('🏠 Migrating apartment payments...');
    const data = this.readJSONFile('apartment-payments.json');
    const apartmentPayments = data.apartmentPayments || data;
    let inserted = 0;

    try {
      // First, get the payment ID mapping (year -> id)
      const [paymentRows] = await db.query('SELECT id, year FROM payments');
      const yearToIdMap: { [key: number]: number } = {};
      (paymentRows as any[]).forEach((row: any) => {
        yearToIdMap[row.year] = row.id;
      });
      console.log('Payment year to ID mapping:', yearToIdMap);

      for (const ap of apartmentPayments) {
        // Convert payment date from ISO to MySQL date format
        let payDate = null;
        const rawDate = ap.paymentDate || ap.startDate;
        if (rawDate) {
          payDate = rawDate.split('T')[0];
        }
        
        // Look up the payment ID by year
        const paymentId = yearToIdMap[ap.year];
        if (!paymentId) {
          console.error(`❌ No payment ID found for year ${ap.year}. Please ensure a payment record exists for this year.`);
          throw new Error(`Missing payment record for year ${ap.year}`);
        }
        
        await db.query(
          `INSERT INTO apartment_payments (apartment_id, payment_id, amount_due, amount_paid, status, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ap.apartmentId,
            paymentId, // Use the looked up payment ID
            ap.amountDue || ap.totalAmount,
            ap.amountPaid || 0,
            ap.status || 'unpaid',
            payDate,
            ap.notes || ''
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'apartment_payments', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} apartment payments\n`);
    } catch (err: any) {
      console.error('❌ Error migrating apartment payments:', err.message);
      this.results.push({ table: 'apartment_payments', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateProjects() {
    console.log('📁 Migrating projects...');
    const data = this.readJSONFile('projects.json');
    const projects = data.projects || data;
    let inserted = 0;

    try {
      for (const project of projects) {
        await db.query(
          `INSERT INTO projects (title, slug, description, content, country, city, year, category, client, featured_image, images, tags, status, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project.title,
            project.slug,
            project.description || '',
            project.content || '',
            project.country || '',
            project.city || '',
            project.year || null,
            project.category || '',
            project.client || '',
            project.featuredImage || '',
            JSON.stringify(project.images || []),
            JSON.stringify(project.tags || []),
            project.status || 'published',
            project.orderIndex || project.order || 0
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'projects', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} projects\n`);
    } catch (err: any) {
      console.error('❌ Error migrating projects:', err.message);
      this.results.push({ table: 'projects', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migratePages() {
    console.log('📄 Migrating pages...');
    const data = this.readJSONFile('pages.json');
    const pages = Array.isArray(data) ? data : (data.pages || []);
    let inserted = 0;

    try {
      for (const page of pages) {
        await db.query(
          `INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            page.title,
            page.slug,
            page.content || '',
            page.metaDescription || '',
            page.metaKeywords || '',
            page.status || 'published',
            page.template || '',
            page.parentId || null,
            page.orderIndex || page.order || 0
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'pages', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} pages\n`);
    } catch (err: any) {
      console.error('❌ Error migrating pages:', err.message);
      this.results.push({ table: 'pages', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateMenu() {
    console.log('🍔 Migrating menu...');
    const data = this.readJSONFile('menu.json');
    const menu = data.menus?.[0]?.items || data.menu || data;
    let inserted = 0;

    try {
      for (const item of menu) {
        await db.query(
          `INSERT INTO menu (title, url, parent_id, order_index, target, css_class, icon, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.title,
            item.url || item.link || '',
            item.parentId || null,
            item.order || item.sort || 0,
            item.target || '_self',
            item.cssClass || '',
            item.icon || '',
            item.isVisible || item.active ? 1 : 0
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'menu', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} menu items\n`);
    } catch (err: any) {
      console.error('❌ Error migrating menu:', err.message);
      this.results.push({ table: 'menu', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateAdminMenu() {
    console.log('⚙️  Migrating admin menu...');
    const data = this.readJSONFile('admin-menu.json');
    const adminMenu = Array.isArray(data) ? data : (data.menu || data.menus || data.adminMenu || []);
    let inserted = 0;

    try {
      // Helper function to insert menu items recursively
      const insertMenuItem = async (item: any, parentId: number | null = null, orderIndex: number = 0) => {
        const result = await db.query(
          `INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.text || item.title,
            item.url || '',
            parentId,
            orderIndex,
            item.icon || '',
            JSON.stringify(item.roles || []),
            item.active !== false ? 1 : 0
          ]
        );
        inserted++;
        
        // Get the inserted ID for potential children
        const insertId = (result as any)[0].insertId;
        
        // Insert children if they exist
        if (item.children && Array.isArray(item.children)) {
          for (let i = 0; i < item.children.length; i++) {
            await insertMenuItem(item.children[i], insertId, i);
          }
        }
      };
      
      // Insert top-level menu items
      for (let i = 0; i < adminMenu.length; i++) {
        await insertMenuItem(adminMenu[i], null, i);
      }
      this.results.push({ table: 'admin_menu', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} admin menu items\n`);
    } catch (err: any) {
      console.error('❌ Error migrating admin menu:', err.message);
      this.results.push({ table: 'admin_menu', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateSlider() {
    console.log('🖼️  Migrating slider...');
    const data = this.readJSONFile('slider.json');
    const slider = data.slides || data.slider || data;
    let inserted = 0;

    try {
      for (const slide of slider) {
        await db.query(
          `INSERT INTO slider (title, subtitle, description, image_url, link_url, link_text, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            slide.title || '',
            slide.subtitle || slide.alt || '',
            slide.description || '',
            slide.imageUrl || slide.image,
            slide.linkUrl || slide.link || '',
            slide.linkText || slide.buttonText || '',
            slide.order || 0,
            slide.isActive || slide.active ? 1 : 0
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'slider', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} slider items\n`);
    } catch (err: any) {
      console.error('❌ Error migrating slider:', err.message);
      this.results.push({ table: 'slider', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateSiteSettings() {
    console.log('⚙️  Migrating site settings...');
    const settings = this.readJSONFile('site-settings.json');
    let inserted = 0;

    try {
      // Convert object to key-value pairs
      for (const [key, value] of Object.entries(settings)) {
        await db.query(
          `INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)`,
          [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
            typeof value
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'site_settings', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} site settings\n`);
    } catch (err: any) {
      console.error('❌ Error migrating site settings:', err.message);
      this.results.push({ table: 'site_settings', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async migrateThemeConfig() {
    console.log('🎨 Migrating theme config...');
    const themeConfig = this.readJSONFile('theme-config.json');
    let inserted = 0;

    try {
      // Convert object to key-value pairs
      for (const [key, value] of Object.entries(themeConfig)) {
        await db.query(
          `INSERT INTO theme_config (theme_key, theme_value) VALUES (?, ?)`,
          [
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          ]
        );
        inserted++;
      }
      this.results.push({ table: 'theme_config', success: true, recordsInserted: inserted });
      console.log(`✅ Migrated ${inserted} theme config items\n`);
    } catch (err: any) {
      console.error('❌ Error migrating theme config:', err.message);
      this.results.push({ table: 'theme_config', success: false, recordsInserted: inserted, error: err.message });
    }
  }

  async run() {
    console.log('🚀 Starting data migration from JSON to MySQL\n');
    console.log('=' .repeat(50));
    console.log('\n');

    try {
      // Test connection first
      const connected = await db.testConnection();
      if (!connected) {
        throw new Error('Could not connect to database');
      }

      // Run schema first
      await this.runSchema();

      // Run migrations in order (respecting foreign key constraints)
      await this.migrateUsers();
      await this.migrateAccounts();
      await this.migrateTransactionCategories();
      await this.migrateTransactions();
      await this.migrateApartments();
      await this.migratePayments();
      await this.migrateApartmentPayments();
      await this.migrateProjects();
      await this.migratePages();
      await this.migrateMenu();
      await this.migrateAdminMenu();
      await this.migrateSlider();
      await this.migrateSiteSettings();
      await this.migrateThemeConfig();

      // Print summary
      console.log('\n');
      console.log('=' .repeat(50));
      console.log('📊 Migration Summary:');
      console.log('=' .repeat(50));
      
      let totalRecords = 0;
      let successCount = 0;
      
      this.results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.table}: ${result.recordsInserted} records${result.error ? ` (${result.error})` : ''}`);
        totalRecords += result.recordsInserted;
        if (result.success) successCount++;
      });
      
      console.log('=' .repeat(50));
      console.log(`Total tables: ${this.results.length}`);
      console.log(`Successful: ${successCount}`);
      console.log(`Failed: ${this.results.length - successCount}`);
      console.log(`Total records migrated: ${totalRecords}`);
      console.log('=' .repeat(50));
      console.log('\n✅ Migration completed!\n');

    } catch (err) {
      console.error('❌ Migration failed:', err);
      throw err;
    } finally {
      await db.close();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new DataMigration();
  migration.run().catch(console.error);
}

export default DataMigration;
