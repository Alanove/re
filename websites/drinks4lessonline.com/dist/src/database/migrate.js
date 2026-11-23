"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const database_1 = require("../config/database");
class DataMigration {
    constructor() {
        this.dataPath = path.join(__dirname, '../../data');
        this.results = [];
    }
    readJSONFile(fileName) {
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
                await database_1.db.query(statement);
            }
            catch (err) {
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
                await database_1.db.query(`INSERT INTO users (id, username, password, salt, email, status, role, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    user.id,
                    user.name || user.username,
                    user.password || null,
                    user.salt || null,
                    user.email || null,
                    user.status || 'Active',
                    user.role || 'user',
                    user.notes || null
                ]);
                inserted++;
            }
            this.results.push({ table: 'users', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} users with original IDs\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO accounts (name, type, balance, currency, description, is_active) VALUES (?, ?, ?, ?, ?, ?)`, [
                    account.name,
                    account.type || account.userId || 'general',
                    account.balance || 0,
                    account.currency || 'XAF',
                    account.description || account.notes || '',
                    account.isActive !== false ? 1 : 0
                ]);
                inserted++;
            }
            this.results.push({ table: 'accounts', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} accounts\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO transaction_categories (name, type, description, color, icon) VALUES (?, ?, ?, ?, ?)`, [
                    category.name,
                    category.type,
                    category.description || '',
                    category.color || '',
                    category.icon || ''
                ]);
                inserted++;
            }
            this.results.push({ table: 'transaction_categories', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} transaction categories\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO transactions (account_id, category_id, amount, type, date, description, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    transaction.accountId,
                    transaction.categoryId,
                    transaction.amount,
                    transaction.type,
                    transaction.date,
                    transaction.description || '',
                    transaction.reference || '',
                    transaction.notes || ''
                ]);
                inserted++;
            }
            this.results.push({ table: 'transactions', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} transactions\n`);
        }
        catch (err) {
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
                let regDate = null;
                if (apt.registrationDate) {
                    regDate = apt.registrationDate.split('T')[0];
                }
                const floor = apt.block || apt.floor || '';
                const apartmentNumber = apt.unitNumberOfficial || apt.apartmentNumber || apt.unitNumberUnofficial;
                let ownerName = `Owner ${apt.ownerId}`;
                let ownerEmail = '';
                if (apt.ownerId) {
                    const [userRows] = await database_1.db.query('SELECT username, email FROM users WHERE id = ?', [apt.ownerId]);
                    if (userRows && userRows.length > 0) {
                        const user = userRows[0];
                        ownerName = user.username;
                        ownerEmail = user.email || '';
                    }
                }
                await database_1.db.query(`INSERT INTO apartments (owner_id, apartment_number, apartment_number_unofficial, owner_name, owner_phone, owner_email, floor, size, bedrooms, bathrooms, registration_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ]);
                inserted++;
            }
            this.results.push({ table: 'apartments', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} apartments with owner links\n`);
        }
        catch (err) {
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
            await database_1.db.query(`INSERT INTO payments (name, description, amount, year, payment_type) VALUES (?, ?, ?, ?, ?)`, [
                'Credit Adjustments',
                'Credit adjustments and prepayments',
                0,
                0,
                'credit_adjustment'
            ]);
            inserted++;
            console.log('✅ Created year 0 payment record for credit adjustments');
            for (const payment of payments) {
                await database_1.db.query(`INSERT INTO payments (name, description, amount, year, due_date, payment_type) VALUES (?, ?, ?, ?, ?, ?)`, [
                    payment.name || `Price per meter ${payment.year}`,
                    payment.description || '',
                    payment.amount || payment.price,
                    payment.year,
                    payment.dueDate || null,
                    payment.paymentType || 'price_per_meter'
                ]);
                inserted++;
            }
            this.results.push({ table: 'payments', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} payments (including year 0)\n`);
        }
        catch (err) {
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
            const [paymentRows] = await database_1.db.query('SELECT id, year FROM payments');
            const yearToIdMap = {};
            paymentRows.forEach((row) => {
                yearToIdMap[row.year] = row.id;
            });
            console.log('Payment year to ID mapping:', yearToIdMap);
            for (const ap of apartmentPayments) {
                let payDate = null;
                const rawDate = ap.paymentDate || ap.startDate;
                if (rawDate) {
                    payDate = rawDate.split('T')[0];
                }
                const paymentId = yearToIdMap[ap.year];
                if (!paymentId) {
                    console.error(`❌ No payment ID found for year ${ap.year}. Please ensure a payment record exists for this year.`);
                    throw new Error(`Missing payment record for year ${ap.year}`);
                }
                await database_1.db.query(`INSERT INTO apartment_payments (apartment_id, payment_id, amount_due, amount_paid, status, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    ap.apartmentId,
                    paymentId,
                    ap.amountDue || ap.totalAmount,
                    ap.amountPaid || 0,
                    ap.status || 'unpaid',
                    payDate,
                    ap.notes || ''
                ]);
                inserted++;
            }
            this.results.push({ table: 'apartment_payments', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} apartment payments\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO projects (title, slug, description, content, country, city, year, category, client, featured_image, images, tags, status, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ]);
                inserted++;
            }
            this.results.push({ table: 'projects', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} projects\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    page.title,
                    page.slug,
                    page.content || '',
                    page.metaDescription || '',
                    page.metaKeywords || '',
                    page.status || 'published',
                    page.template || '',
                    page.parentId || null,
                    page.orderIndex || page.order || 0
                ]);
                inserted++;
            }
            this.results.push({ table: 'pages', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} pages\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO menu (title, url, parent_id, order_index, target, css_class, icon, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    item.title,
                    item.url || item.link || '',
                    item.parentId || null,
                    item.order || item.sort || 0,
                    item.target || '_self',
                    item.cssClass || '',
                    item.icon || '',
                    item.isVisible || item.active ? 1 : 0
                ]);
                inserted++;
            }
            this.results.push({ table: 'menu', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} menu items\n`);
        }
        catch (err) {
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
            const insertMenuItem = async (item, parentId = null, orderIndex = 0) => {
                const result = await database_1.db.query(`INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    item.text || item.title,
                    item.url || '',
                    parentId,
                    orderIndex,
                    item.icon || '',
                    JSON.stringify(item.roles || []),
                    item.active !== false ? 1 : 0
                ]);
                inserted++;
                const insertId = result[0].insertId;
                if (item.children && Array.isArray(item.children)) {
                    for (let i = 0; i < item.children.length; i++) {
                        await insertMenuItem(item.children[i], insertId, i);
                    }
                }
            };
            for (let i = 0; i < adminMenu.length; i++) {
                await insertMenuItem(adminMenu[i], null, i);
            }
            this.results.push({ table: 'admin_menu', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} admin menu items\n`);
        }
        catch (err) {
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
                await database_1.db.query(`INSERT INTO slider (title, subtitle, description, image_url, link_url, link_text, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    slide.title || '',
                    slide.subtitle || slide.alt || '',
                    slide.description || '',
                    slide.imageUrl || slide.image,
                    slide.linkUrl || slide.link || '',
                    slide.linkText || slide.buttonText || '',
                    slide.order || 0,
                    slide.isActive || slide.active ? 1 : 0
                ]);
                inserted++;
            }
            this.results.push({ table: 'slider', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} slider items\n`);
        }
        catch (err) {
            console.error('❌ Error migrating slider:', err.message);
            this.results.push({ table: 'slider', success: false, recordsInserted: inserted, error: err.message });
        }
    }
    async migrateSiteSettings() {
        console.log('⚙️  Migrating site settings...');
        const settings = this.readJSONFile('site-settings.json');
        let inserted = 0;
        try {
            for (const [key, value] of Object.entries(settings)) {
                await database_1.db.query(`INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)`, [
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value),
                    typeof value
                ]);
                inserted++;
            }
            this.results.push({ table: 'site_settings', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} site settings\n`);
        }
        catch (err) {
            console.error('❌ Error migrating site settings:', err.message);
            this.results.push({ table: 'site_settings', success: false, recordsInserted: inserted, error: err.message });
        }
    }
    async migrateThemeConfig() {
        console.log('🎨 Migrating theme config...');
        const themeConfig = this.readJSONFile('theme-config.json');
        let inserted = 0;
        try {
            for (const [key, value] of Object.entries(themeConfig)) {
                await database_1.db.query(`INSERT INTO theme_config (theme_key, theme_value) VALUES (?, ?)`, [
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value)
                ]);
                inserted++;
            }
            this.results.push({ table: 'theme_config', success: true, recordsInserted: inserted });
            console.log(`✅ Migrated ${inserted} theme config items\n`);
        }
        catch (err) {
            console.error('❌ Error migrating theme config:', err.message);
            this.results.push({ table: 'theme_config', success: false, recordsInserted: inserted, error: err.message });
        }
    }
    async run() {
        console.log('🚀 Starting data migration from JSON to MySQL\n');
        console.log('='.repeat(50));
        console.log('\n');
        try {
            const connected = await database_1.db.testConnection();
            if (!connected) {
                throw new Error('Could not connect to database');
            }
            await this.runSchema();
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
            console.log('\n');
            console.log('='.repeat(50));
            console.log('📊 Migration Summary:');
            console.log('='.repeat(50));
            let totalRecords = 0;
            let successCount = 0;
            this.results.forEach(result => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${result.table}: ${result.recordsInserted} records${result.error ? ` (${result.error})` : ''}`);
                totalRecords += result.recordsInserted;
                if (result.success)
                    successCount++;
            });
            console.log('='.repeat(50));
            console.log(`Total tables: ${this.results.length}`);
            console.log(`Successful: ${successCount}`);
            console.log(`Failed: ${this.results.length - successCount}`);
            console.log(`Total records migrated: ${totalRecords}`);
            console.log('='.repeat(50));
            console.log('\n✅ Migration completed!\n');
        }
        catch (err) {
            console.error('❌ Migration failed:', err);
            throw err;
        }
        finally {
            await database_1.db.close();
        }
    }
}
if (require.main === module) {
    const migration = new DataMigration();
    migration.run().catch(console.error);
}
exports.default = DataMigration;
//# sourceMappingURL=migrate.js.map