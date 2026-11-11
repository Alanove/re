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
        // Preserve original user IDs for stable foreign keys in imported content
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
