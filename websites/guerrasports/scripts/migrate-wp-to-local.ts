import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';
import { db } from '../src/config/database';
import * as fs from 'fs-extra';

// --- CONFIGURATION ---

// WordPress Database Configuration (Source)
const WP_DB_CONFIG = {
    host: 'localhost',
    user: 'sa',
    password: 'P@55w0rd',
    database: 'guerrasports_gs_7dmrf', // guerrasports_gs_7dmrf
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const WP_PREFIX = 'z3ouw3fl_'; // WordPress table prefix
const WP_UPLOADS_DIR = String.raw`C:\Work\guerrasports.com\wp-content\uploads`; // Use String.raw to handle backslashes
const DEST_UPLOADS_DIR = path.join(process.cwd(), 'public/uploads/products');

// --- INTERFACES ---

interface WPTerm {
    term_id: number;
    name: string;
    slug: string;
    parent: number;
    taxonomy: string;
    description: string;
}

interface WPPost {
    ID: number;
    post_title: string;
    post_name: string;
    post_content: string;
    post_excerpt: string;
    post_parent: number;
    post_type: string;
}

// --- MIGRATION CLASS ---

class WPMigration {
    private wpConnection: mysql.Pool | null = null;
    private localConnection: mysql.PoolConnection | null = null;

    // Maps to keep track of any IDs between WP and Local
    private categoryMap = new Map<number, number>(); // WP Term ID -> Local Category ID
    private brandMap = new Map<number, number>();    // WP Term ID -> Local Brand ID
    private productMap = new Map<number, number>();  // WP Post ID -> Local Product ID
    private attributeMap = new Map<string, number>(); // Attribute Slug (e.g., 'pa_color') -> Local Variant Type ID
    private attributeValueMap = new Map<string, number>(); // 'pa_color:red' -> Local Variant Type Value ID

    async connect() {
        try {
            console.log('🔌 Connecting to databases...');

            // Connect to WP Database
            this.wpConnection = mysql.createPool(WP_DB_CONFIG);
            await this.wpConnection.query('SELECT 1');
            console.log('   ✅ Connected to WordPress Database');

            // Connect to Local Database
            const localPool = db.getPool();
            this.localConnection = await localPool.getConnection();
            console.log('   ✅ Connected to Local Database');

            // Ensure dest folder exists
            await fs.ensureDir(DEST_UPLOADS_DIR);
            console.log(`   ✅ Validated uploads directory: ${DEST_UPLOADS_DIR}`);

        } catch (error) {
            console.error('❌ Connection failed:', error);
            throw error;
        }
    }

    async close() {
        if (this.wpConnection) {
            await this.wpConnection.end();
        }
        if (this.localConnection) {
            this.localConnection.release();
        }
        await db.close();
    }

    // --- HELPERS ---

    private async getWPMeta(postId: number, key: string): Promise<string | null> {
        const [rows] = await this.wpConnection!.query<any[]>(
            `SELECT meta_value FROM ${WP_PREFIX}postmeta WHERE post_id = ? AND meta_key = ?`,
            [postId, key]
        );
        return rows.length > 0 ? rows[0].meta_value : null;
    }

    private async copyImage(wpAttachmentId: number): Promise<string | null> {
        if (!wpAttachmentId) return null;

        try {
            // Get attached file path from meta
            const relPath = await this.getWPMeta(wpAttachmentId, '_wp_attached_file');
            if (!relPath) return null;

            // Construct source full path
            const sourcePath = path.join(WP_UPLOADS_DIR, relPath);

            if (!fs.existsSync(sourcePath)) {
                // Try converting forward slashes to backslashes if standard join fails on some partials
                // But path.join should handle it.
                // Log warning and skip
                console.warn(`   ⚠️ Image file not found at: ${sourcePath}`);
                return null;
            }

            // Generate new filename to avoid collisions and keep it flat
            const uniqueName = `${wpAttachmentId}_${path.basename(relPath)}`; // e.g. 1234_image.jpg
            const destPath = path.join(DEST_UPLOADS_DIR, uniqueName);

            // Copy file
            await fs.copy(sourcePath, destPath);

            return `/uploads/products/${uniqueName}`;
        } catch (error) {
            console.error(`   ❌ Failed to copy image ${wpAttachmentId}:`, error);
            return null;
        }
    }

    // Helper to get color code
    async getColorCode(termId: number): Promise<string | null> {
        const [rows] = await this.wpConnection!.query<any[]>(`
          SELECT meta_value FROM ${WP_PREFIX}termmeta 
          WHERE term_id = ? AND meta_key IN ('product_attribute_color', 'color', 'pa_color_swatch_id')
          LIMIT 1
      `, [termId]);
        if (rows.length > 0) return rows[0].meta_value;
        return null;
    }

    // Helper to get term image
    async getTermImage(termId: number): Promise<string | null> {
        const [rows] = await this.wpConnection!.query<any[]>(`
          SELECT meta_value FROM ${WP_PREFIX}termmeta 
          WHERE term_id = ? AND meta_key IN ('thumbnail_id', 'product_attribute_image')
          LIMIT 1
      `, [termId]);

        if (rows.length > 0 && rows[0].meta_value) {
            return this.copyImage(parseInt(rows[0].meta_value));
        }
        return null;
    }


    // --- STEPS ---

    async clearData() {
        console.log('\n🧹 Clearing existing data...');
        try {
            await this.localConnection!.query('SET FOREIGN_KEY_CHECKS = 0');

            // Also clear product_categories_map
            const tables = [
                'cart_items', 'order_items', 'wishlists', 'product_images', 'product_reviews',
                'product_variants', 'products', 'product_attributes', 'product_categories', 'product_categories_map',
                'brands', 'variant_type_values', 'variant_types', 'pages', 'menu'
            ];

            for (const table of tables) {
                // Check if table exists before truncating to avoid errors if map table created recently
                try {
                     await this.localConnection!.query(`TRUNCATE TABLE ${table}`);
                } catch (e: any) {
                    if (e.code === 'ER_NO_SUCH_TABLE') {
                        // ignore
                    } else {
                        throw e;
                    }
                }
            }

            await this.localConnection!.query('SET FOREIGN_KEY_CHECKS = 1');
            console.log('   ✅ Data cleared');
        } catch (error) {
            console.error('   ❌ Failed to clear data:', error);
            throw error;
        }
    }

    // Helper to get WP Post
    async getPost(id: number): Promise<WPPost | null> {
        const [rows] = await this.wpConnection!.query<any[]>(`
            SELECT ID, post_title, post_name, post_content, post_excerpt, post_parent, post_type 
            FROM ${WP_PREFIX}posts WHERE ID = ?
        `, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    // Helper to get WP Term
    async getTerm(id: number): Promise<WPTerm | null> {
        const [rows] = await this.wpConnection!.query<any[]>(`
            SELECT t.term_id, t.name, t.slug, t.term_group, tt.parent, tt.taxonomy, tt.description
            FROM ${WP_PREFIX}terms t
            JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
            WHERE t.term_id = ?
        `, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    async migrateMenus() {
        console.log('\n🍔 Migrating Menus...');
        try {
            // Fetch WP Menus
            const [menus] = await this.wpConnection!.query<any[]>(`
                SELECT t.term_id, t.name, t.slug 
                FROM ${WP_PREFIX}terms t 
                JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id 
                WHERE tt.taxonomy = 'nav_menu'
            `);

            for (const menu of menus) {
                // Create Root Node for this Menu in 'menu' table
                const [res] = await this.localConnection!.query<any>(`
                    INSERT INTO menu (title, url, is_visible) VALUES (?, ?, ?)
                `, [menu.name, '#', true]);
                const menuRootId = res.insertId;

                // Get Items
                const [items] = await this.wpConnection!.query<any[]>(`
                    SELECT p.ID, p.post_title, p.menu_order, p.post_parent
                    FROM ${WP_PREFIX}posts p
                    JOIN ${WP_PREFIX}term_relationships tr ON p.ID = tr.object_id
                    JOIN ${WP_PREFIX}term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                    WHERE tt.term_id = ? AND p.post_type = 'nav_menu_item' AND p.post_status = 'publish'
                    ORDER BY p.menu_order ASC
                `, [menu.term_id]);

                const itemMap = new Map<number, number>();
                itemMap.set(0, menuRootId); // Map 0 (root parent) to menuRootId

                // To handle hierarchy, we need 'menu_item_parent' meta
                const enrichedItems = [];
                for (const item of items) {
                    const meta = await this.getAllMeta(item.ID);
                    enrichedItems.push({
                        ...item,
                        meta,
                        parentId: parseInt(meta['_menu_item_menu_item_parent'] || '0')
                    });
                }

                // Repeated pass sort to handle dependencies
                let toProcess = [...enrichedItems];
                let changed = true;

                while (toProcess.length > 0 && changed) {
                    changed = false;
                    const ready = toProcess.filter(i => i.parentId === 0 || itemMap.has(i.parentId));

                    for (const item of ready) {
                        const parentLocalId = itemMap.get(item.parentId) || menuRootId;

                        // Resolve Title and URL
                        const type = item.meta['_menu_item_type']; // post_type, taxonomy, custom
                        const objectType = item.meta['_menu_item_object']; // page, product, category, etc.
                        const objectId = parseInt(item.meta['_menu_item_object_id'] || '0');

                        let title = item.post_title || item.meta['_menu_item_title'];
                        let url = item.meta['_menu_item_url'] || '#';

                        if (type === 'post_type') {
                            const p = await this.getPost(objectId);
                            if (p) {
                                if (!title || title === '') title = p.post_title;
                                if (objectType === 'page') url = `/pages/${p.post_name}`;
                                else if (objectType === 'product') url = `/products/${p.post_name}`;
                                else if (objectType === 'post') url = `/sub/${p.post_name}`;
                            }
                        } else if (type === 'taxonomy') {
                            const t = await this.getTerm(objectId);
                            if (t) {
                                if (!title || title === '') title = t.name;
                                if (objectType === 'product_cat') url = `/collections/${t.slug}`;
                                else if (objectType === 'category') url = `/category/${t.slug}`;
                            }
                        }

                        if (!title || title.trim() === '') title = 'Untitled';

                        const [ins] = await this.localConnection!.query<any>(`
                            INSERT INTO menu (title, url, parent_id, order_index, is_visible)
                            VALUES (?, ?, ?, ?, ?)
                        `, [title, url, parentLocalId, item.menu_order, true]);

                        itemMap.set(item.ID, ins.insertId);

                        const idx = toProcess.indexOf(item);
                        if (idx > -1) toProcess.splice(idx, 1);
                        changed = true;
                    }
                }
                if (toProcess.length > 0) {
                    console.warn(`   ⚠️ Unreachable menu items in '${menu.name}': ${toProcess.length}`);
                }
            }
            console.log(`   ✅ Migrated ${menus.length} menus`);
        } catch (error) {
            console.error('   ❌ Menu migration failed:', error);
        }
    }

    async migrateCategories() {
        console.log('\n📂 Migrating Categories...');
        try {
            const [terms] = await this.wpConnection!.query<any[]>(`
                SELECT t.term_id, t.name, t.slug, tt.description, tt.parent, tm.meta_value as thumbnail_id
                FROM ${WP_PREFIX}terms t
                JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
                LEFT JOIN ${WP_PREFIX}termmeta tm ON t.term_id = tm.term_id AND tm.meta_key = 'thumbnail_id'
                WHERE tt.taxonomy = 'product_cat'
                ORDER BY tt.parent ASC
            `);

            const termList = terms.map(t => ({ ...t }));
            const processed = new Set<number>();

            let changed = true;
            while (termList.length > 0 && changed) {
                changed = false;
                const ready = termList.filter(t => t.parent === 0 || processed.has(t.parent));

                for (const term of ready) {
                    let localParentId: number | null = null;
                    if (term.parent !== 0) {
                        localParentId = this.categoryMap.get(term.parent) || null;
                    }

                    // Image
                    let imageUrl = null;
                    if (term.thumbnail_id) {
                        imageUrl = await this.copyImage(parseInt(term.thumbnail_id));
                    }

                    // Insert into local DB
                    const [res] = await this.localConnection!.query<any>(`
                        INSERT INTO product_categories (name, slug, description, parent_id, image_url, is_active)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [term.name, term.slug, term.description || '', localParentId, imageUrl, true]);

                    this.categoryMap.set(term.term_id, res.insertId);
                    processed.add(term.term_id);

                    const idx = termList.indexOf(term);
                    if (idx > -1) termList.splice(idx, 1);
                    changed = true;
                }
            }

            if (termList.length > 0) {
                console.warn(`   ⚠️ ${termList.length} categories skipped due to missing parents.`);
            }

            console.log(`   ✅ Migrated ${processed.size} categories`);
        } catch (error) {
            console.error('   ❌ Category migration failed:', error);
        }
    }

    async migrateBrands() {
        console.log('\n🏷️ Migrating Brands...');
        try {
            const [taxonomies] = await this.wpConnection!.query<any[]>(`
                SELECT DISTINCT taxonomy FROM ${WP_PREFIX}term_taxonomy WHERE taxonomy LIKE '%brand%'
            `);

            const brandTax = taxonomies.length > 0 ? taxonomies[0].taxonomy : null;
            if (!brandTax) {
                console.log('   ⚠️ No brand taxonomy found (checked for %brand%). Skipping brands.');
                return;
            }
            console.log(`   ℹ️ Found brand taxonomy: '${brandTax}'`);

            const [terms] = await this.wpConnection!.query<any[]>(`
                SELECT t.term_id, t.name, t.slug, tt.description
                FROM ${WP_PREFIX}terms t
                JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
                WHERE tt.taxonomy = ?
            `, [brandTax]);

            for (const term of terms) {
                const [res] = await this.localConnection!.query<any>(`
                    INSERT INTO brands (name, slug, description, is_active)
                    VALUES (?, ?, ?, ?)
                `, [term.name, term.slug, term.description || '', true]);

                this.brandMap.set(term.term_id, res.insertId);
            }

            console.log(`   ✅ Migrated ${terms.length} brands`);
        } catch (error) {
            console.error('   ❌ Brand migration failed:', error);
        }
    }

    async migrateAttributes() {
        console.log('\n⚙️ Migrating Attributes...');
        try {
            const [paTaxonomies] = await this.wpConnection!.query<any[]>(`
                SELECT taxonomy FROM ${WP_PREFIX}term_taxonomy WHERE taxonomy LIKE 'pa_%' GROUP BY taxonomy
            `);

            for (const tx of paTaxonomies) {
                const taxName = tx.taxonomy;
                const label = taxName.replace('pa_', '').replace(/-/g, ' ');
                const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);

                const hasImage = label.toLowerCase().includes('color') || label.toLowerCase().includes('colour');

                // Insert Variant Type
                const [res] = await this.localConnection!.query<any>(`
                    INSERT INTO variant_types (name, slug, has_image, is_active) VALUES (?, ?, ?, ?)
                `, [formattedLabel, taxName, hasImage, true]);

                const typeId = res.insertId;
                this.attributeMap.set(taxName, typeId);

                // Get terms
                const [terms] = await this.wpConnection!.query<any[]>(`
                    SELECT t.term_id, t.name, t.slug
                    FROM ${WP_PREFIX}terms t
                    JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
                    WHERE tt.taxonomy = ?
                `, [taxName]);

                for (const term of terms) {
                    let colorCode = null;
                    if (hasImage) {
                        colorCode = await this.getColorCode(term.term_id);
                        if (!colorCode && ['white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'grey', 'gray'].includes(term.slug)) {
                            colorCode = term.slug;
                        }
                    }

                    const imageUrl = await this.getTermImage(term.term_id);

                    const [valRes] = await this.localConnection!.query<any>(`
                        INSERT INTO variant_type_values (variant_type_id, value, color_code, image_url, is_active)
                        VALUES (?, ?, ?, ?, ?)
                    `, [typeId, term.name, colorCode, imageUrl, true]);

                    this.attributeValueMap.set(`${taxName}:${term.slug}`, valRes.insertId);
                }
            }

            console.log(`   ✅ Migrated ${paTaxonomies.length} attribute types`);
        } catch (error) {
            console.error('   ❌ Attribute migration failed:', error);
        }
    }

    async migrateProducts() {
        console.log('\n📦 Migrating Products...');
        try {
            const [products] = await this.wpConnection!.query<any[]>(`
                SELECT ID, post_title, post_name, post_content, post_excerpt, post_status, post_date
                FROM ${WP_PREFIX}posts 
                WHERE post_type = 'product' AND post_status IN ('publish', 'draft')
            `);

            for (const p of products) {
                const meta = await this.getAllMeta(p.ID);

                const price = meta['_price'] ? parseFloat(meta['_price']) : 0;
                const regularPrice = meta['_regular_price'] ? parseFloat(meta['_regular_price']) : 0;
                const stock = meta['_stock'] ? parseInt(meta['_stock']) : 0;
                const manageStock = meta['_manage_stock'] === 'yes';
                const sku = meta['_sku'] || `WP-${p.ID}`;
                const status = p.post_status === 'publish' ? 'published' : 'draft';

                let slug = p.post_name;
                if (!slug || slug.trim() === '') {
                    slug = p.post_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    if (!slug) slug = `product-${p.ID}`;
                }
                if (status === 'draft') slug = `${slug}-${p.ID}`;

                // --- Category & Brand ---
                const taxonomies = await this.getPostTaxonomies(p.ID);
                
                // Find all categories
                const categoryIds: number[] = [];
                for (const tId of taxonomies) {
                    if (this.categoryMap.has(tId)) {
                        categoryIds.push(this.categoryMap.get(tId)!);
                    }
                }
                
                // Primary Category
                const categoryId = categoryIds.length > 0 ? categoryIds[0] : null;

                // Find brand
                let brandId: number | null = null;
                const brId = taxonomies.find(t => this.brandMap.has(t));
                if (brId) brandId = this.brandMap.get(brId)!;

                // --- Insert Product ---
                const [prodRes] = await this.localConnection!.query<any>(`
                    INSERT INTO products (
                        name, slug, sku, description, short_description,
                        price, compare_at_price, stock_quantity, track_inventory,
                        status, category_id, brand_id, created_at, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    p.post_title, slug, sku, p.post_content, p.post_excerpt,
                    price, regularPrice > price ? regularPrice : null, stock, manageStock,
                    status, categoryId, brandId, p.post_date, true
                ]);

                const productId = prodRes.insertId;
                this.productMap.set(p.ID, productId);
                
                // --- Multiple Categories Mapping ---
                if (categoryIds.length > 0) {
                     for (const cId of categoryIds) {
                         const isPrimary = cId === categoryId;
                         await this.localConnection!.query(`
                            INSERT IGNORE INTO product_categories_map (product_id, category_id, is_primary)
                            VALUES (?, ?, ?)
                         `, [productId, cId, isPrimary]);
                     }
                }

                // --- Images (Main & Gallery) ---
                const thumbId = meta['_thumbnail_id'];
                if (thumbId) {
                    const imgUrl = await this.copyImage(parseInt(thumbId));
                    if (imgUrl) {
                        await this.localConnection!.query(`
                            INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)
                        `, [productId, imgUrl, true]);
                    }
                }

                const galleryIds = meta['_product_image_gallery'];
                if (galleryIds) {
                    const ids = galleryIds.split(',').map((id: string) => parseInt(id.trim()));
                    const thumbIdInt = thumbId ? parseInt(thumbId) : 0;
                    for (const gid of ids) {
                        if (!gid || gid === thumbIdInt) continue;
                        const imgUrl = await this.copyImage(gid);
                        if (imgUrl) {
                            await this.localConnection!.query(`
                                INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)
                            `, [productId, imgUrl, false]);
                        }
                    }
                }

                await this.migrateVariants(p.ID, productId);
            }

            console.log(`   ✅ Migrated ${products.length} products`);
        } catch (error) {
            console.error('   ❌ Product migration failed:', error);
        }
    }

    async migrateVariants(wpParentId: number, localProductId: number) {
        const [variations] = await this.wpConnection!.query<any[]>(`
            SELECT ID, post_title, post_excerpt
            FROM ${WP_PREFIX}posts
            WHERE post_type = 'product_variation' AND post_parent = ? AND post_status = 'publish'
        `, [wpParentId]);

        if (variations.length === 0) return;

        // Map to store unique images linked to attribute values (e.g. Red -> ImageID)
        const attributeImages = new Map<number, number>();

        // Map to store used attribute values for this product: TypeID -> Set<ValueID>
        const productAttributes = new Map<number, Set<number>>();

        for (const v of variations) {
            const meta = await this.getAllMeta(v.ID);


            const price = meta['_price'] ? parseFloat(meta['_price']) : 0;
            const stock = meta['_stock'] ? parseInt(meta['_stock']) : 0;
            const manageStock = meta['_manage_stock'] === 'yes';
            const sku = meta['_sku'] || null;
            const thumbId = meta['_thumbnail_id'];
            


            const attributes: any = {};
            let colorAttributeId: number | null = null; 

            for (const key in meta) {
                if (key.startsWith('attribute_')) {
                    const taxOrName = key.replace('attribute_', '');
                    const valSlug = meta[key];
                    if (!valSlug) continue;

                    if (this.attributeMap.has(taxOrName)) {
                        // Global Attribute
                        const cleanName = taxOrName.replace('pa_', '');
                        attributes[cleanName] = valSlug;
                        const typeId = this.attributeMap.get(taxOrName)!;

                        if (this.attributeValueMap.has(`${taxOrName}:${valSlug}`)) {
                            const valId = this.attributeValueMap.get(`${taxOrName}:${valSlug}`)!;
                            
                            // Track for product_attributes table
                            if (!productAttributes.has(typeId)) {
                                productAttributes.set(typeId, new Set());
                            }
                            productAttributes.get(typeId)!.add(valId);

                            // Check if this is a color-like attribute to link image
                            if ((cleanName.toLowerCase() === 'color' || cleanName.toLowerCase() === 'colour') && thumbId) {
                                colorAttributeId = valId;
                            }
                        }
                    } else {
                        attributes[taxOrName] = valSlug;
                    }
                }
            }
            
            // If we found a color attribute and an image, store it for later deduplicated insertion
            // User Request: "find the first image for a spcific coloor and add it ... dont add any more"
            if (colorAttributeId && thumbId && !attributeImages.has(colorAttributeId)) {
                attributeImages.set(colorAttributeId, parseInt(thumbId));
            }

            // Insert Variant
            await this.localConnection!.query<any>(`
                INSERT INTO product_variants (
                    product_id, sku, name, attributes, price, stock_quantity, track_inventory, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                localProductId, sku, v.post_title || 'Variant',
                JSON.stringify(attributes), price, stock, manageStock, true
            ]);
        }
        
        // Insert Deduplicated Attribute Images (Color Images)
        for (const [attrValId, wpThumbId] of attributeImages.entries()) {
             const imgUrl = await this.copyImage(wpThumbId);
             if (imgUrl) {
                 await this.localConnection!.query(`
                    INSERT INTO product_images (product_id, image_url, is_primary, attribute_value_id) 
                    VALUES (?, ?, ?, ?)
                `, [localProductId, imgUrl, false, attrValId]);
             }
        }

        // Insert into product_attributes (Populate selected values for UI)
        for (const [typeId, valueSet] of productAttributes.entries()) {
            const selectedValues = Array.from(valueSet);
             await this.localConnection!.query(`
                INSERT INTO product_attributes (product_id, variant_type_id, selected_values)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE selected_values = VALUES(selected_values)
            `, [localProductId, typeId, JSON.stringify(selectedValues)]);
        }
    }

    async migratePages() {
        console.log('\n📄 Migrating Pages...');
        try {
            const [pages] = await this.wpConnection!.query<any[]>(`
                SELECT ID, post_title, post_name, post_content, post_status, post_date
                FROM ${WP_PREFIX}posts
                WHERE post_type = 'page' AND post_status = 'publish'
            `);

            for (const p of pages) {
                await this.localConnection!.query(`
                    INSERT INTO pages (title, slug, content, status, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [p.post_title, p.post_name, p.post_content, 'published', p.post_date]);
            }
            console.log(`   ✅ Migrated ${pages.length} pages`);
        } catch (error) {
            console.error('   ❌ Page migration failed:', error);
        }
    }

    // --- UTILS ---

    async getPostTaxonomies(postId: number): Promise<number[]> {
        const [rows] = await this.wpConnection!.query<any[]>(`
            SELECT tt.term_id
            FROM ${WP_PREFIX}term_relationships tr
            JOIN ${WP_PREFIX}term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            WHERE tr.object_id = ?
        `, [postId]);
        return rows.map(r => r.term_id);
    }

    async getAllMeta(postId: number): Promise<Record<string, string>> {
        const [rows] = await this.wpConnection!.query<any[]>(`
            SELECT meta_key, meta_value FROM ${WP_PREFIX}postmeta WHERE post_id = ?
        `, [postId]);

        const meta: Record<string, string> = {};
        for (const r of rows) {
            meta[r.meta_key] = r.meta_value;
        }
        return meta;
    }

    async run() {
        try {
            await this.connect();

            // Order matters due to foreign keys
            await this.clearData();

            await this.migrateMenus();
            await this.migrateCategories();
            await this.migrateBrands();
            await this.migrateAttributes(); // Variant Types
            await this.migrateProducts();   // Products, Images, Variants
            await this.migratePages();

            console.log('\n🏁 Migration completed successfully');
        } catch (error) {
            console.error('\n❌ Migration failed:', error);
        } finally {
            await this.close();
        }
    }
}

if (require.main === module) {
    const migration = new WPMigration();
    migration.run();
}

export default WPMigration;
