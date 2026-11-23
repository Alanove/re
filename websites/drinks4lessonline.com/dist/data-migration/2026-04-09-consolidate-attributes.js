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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('Loaded env for:', nodeEnv);
class ConsolidateAttributesMigration {
    constructor() {
        this.connection = null;
        this.db = require('../src/config/database').db;
    }
    normalizeVal(s) {
        return s.trim().toLowerCase();
    }
    async getVariantType(name) {
        const [rows] = await this.connection.query('SELECT id, name FROM variant_types WHERE LOWER(name) = LOWER(?) AND is_active = TRUE LIMIT 1', [name]);
        return rows.length ? { id: rows[0].id, name: rows[0].name } : null;
    }
    async getValues(variantTypeId) {
        const [rows] = await this.connection.query('SELECT id, value, color_code, image_url, thumb_url, display_order, is_active, is_preselected FROM variant_type_values WHERE variant_type_id = ?', [variantTypeId]);
        return rows;
    }
    async findValueInType(targetTypeId, valueText) {
        const [rows] = await this.connection.query('SELECT id FROM variant_type_values WHERE variant_type_id = ? AND LOWER(value) = LOWER(?) LIMIT 1', [targetTypeId, valueText]);
        return rows.length ? rows[0].id : null;
    }
    async insertValue(targetTypeId, sourceRow) {
        const [result] = await this.connection.query(`INSERT INTO variant_type_values
         (variant_type_id, value, color_code, image_url, thumb_url, display_order, is_active, is_preselected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            targetTypeId,
            sourceRow.value,
            sourceRow.color_code ?? null,
            sourceRow.image_url ?? null,
            sourceRow.thumb_url ?? null,
            sourceRow.display_order ?? 0,
            sourceRow.is_active ?? true,
            sourceRow.is_preselected ?? false,
        ]);
        return result.insertId;
    }
    parseSelectedValues(raw) {
        if (!raw)
            return [];
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
        }
        catch {
            return [];
        }
    }
    async mergeAttributeType(sourceTypeName, targetTypeName) {
        const conn = this.connection;
        const source = await this.getVariantType(sourceTypeName);
        if (!source) {
            console.log(`  ⚠️  Source type "${sourceTypeName}" not found — skipping`);
            return;
        }
        const target = await this.getVariantType(targetTypeName);
        if (!target) {
            throw new Error(`Target type "${targetTypeName}" does not exist in variant_types. ` +
                `Cannot merge "${sourceTypeName}" into it.`);
        }
        console.log(`\n  Merging "${source.name}" (id=${source.id}) → "${target.name}" (id=${target.id})`);
        const sourceValues = await this.getValues(source.id);
        console.log(`    Source has ${sourceValues.length} value(s)`);
        const valueIdMap = new Map();
        for (const sv of sourceValues) {
            let newId = await this.findValueInType(target.id, sv.value);
            if (newId === null) {
                newId = await this.insertValue(target.id, sv);
                console.log(`    + Created value "${sv.value}" in "${target.name}" (new id=${newId})`);
            }
            else {
                console.log(`    = Value "${sv.value}" already exists in "${target.name}" (id=${newId})`);
            }
            valueIdMap.set(sv.id, newId);
        }
        const [paRows] = await conn.query('SELECT product_id, selected_values FROM product_attributes WHERE variant_type_id = ?', [source.id]);
        console.log(`    ${paRows.length} product_attributes row(s) to migrate`);
        for (const pa of paRows) {
            const productId = pa.product_id;
            const oldSelected = this.parseSelectedValues(pa.selected_values);
            const remapped = oldSelected
                .map(id => valueIdMap.get(id) ?? null)
                .filter((id) => id !== null);
            const [existingRows] = await conn.query('SELECT selected_values FROM product_attributes WHERE product_id = ? AND variant_type_id = ?', [productId, target.id]);
            if (existingRows.length > 0) {
                const existingSelected = this.parseSelectedValues(existingRows[0].selected_values);
                const merged = Array.from(new Set([...existingSelected, ...remapped]));
                await conn.query('UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?', [JSON.stringify(merged), productId, target.id]);
                console.log(`    ↔ Merged selected_values for product ${productId}: [${merged.join(', ')}]`);
            }
            else {
                await conn.query('INSERT INTO product_attributes (product_id, variant_type_id, selected_values) VALUES (?, ?, ?)', [productId, target.id, JSON.stringify(remapped)]);
                console.log(`    + Added product_attribute for product ${productId}, type "${target.name}"`);
            }
            await conn.query('DELETE FROM product_attributes WHERE product_id = ? AND variant_type_id = ?', [productId, source.id]);
        }
        const [variantRows] = await conn.query(`SELECT id, attributes FROM product_variants
       WHERE JSON_CONTAINS_PATH(attributes, 'one', ?)`, [`$."${source.name}"`]);
        console.log(`    ${variantRows.length} product_variant(s) with key "${source.name}" to update`);
        for (const vrow of variantRows) {
            let attrs;
            try {
                attrs = typeof vrow.attributes === 'string'
                    ? JSON.parse(vrow.attributes)
                    : vrow.attributes;
            }
            catch {
                console.warn(`    ⚠️  Could not parse attributes for variant id=${vrow.id}, skipping`);
                continue;
            }
            const sourceVal = attrs[source.name];
            if (sourceVal === undefined)
                continue;
            if (!(target.name in attrs)) {
                attrs[target.name] = sourceVal;
            }
            delete attrs[source.name];
            await conn.query('UPDATE product_variants SET attributes = ? WHERE id = ?', [JSON.stringify(attrs), vrow.id]);
        }
        await conn.query('DELETE FROM variant_types WHERE id = ?', [source.id]);
        console.log(`    ✓ Deleted source type "${source.name}" (id=${source.id})`);
    }
    async normalizeSizeValues() {
        const conn = this.connection;
        const sizeType = await this.getVariantType('Size');
        if (!sizeType) {
            console.log('\n  ⚠️  "Size" attribute type not found — skipping size normalization');
            return;
        }
        console.log(`\n  Normalizing "size-X" values in "${sizeType.name}" (id=${sizeType.id})`);
        const allSizeValues = await this.getValues(sizeType.id);
        const sluggedValues = allSizeValues.filter(v => /^size-/i.test(v.value));
        console.log(`    Found ${sluggedValues.length} slugged value(s) to normalize`);
        for (const sv of sluggedValues) {
            const normalized = sv.value.replace(/^size-/i, '').toUpperCase();
            console.log(`\n    Processing: "${sv.value}" (id=${sv.id}) → "${normalized}"`);
            const existingId = await this.findValueInType(sizeType.id, normalized);
            if (existingId !== null && existingId !== sv.id) {
                console.log(`    = "${normalized}" already exists (id=${existingId}), remapping...`);
                const [paRows] = await conn.query('SELECT product_id, selected_values FROM product_attributes WHERE variant_type_id = ?', [sizeType.id]);
                for (const pa of paRows) {
                    const sel = this.parseSelectedValues(pa.selected_values);
                    if (!sel.includes(sv.id))
                        continue;
                    const remapped = Array.from(new Set(sel.map(id => (id === sv.id ? existingId : id))));
                    await conn.query('UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?', [JSON.stringify(remapped), pa.product_id, sizeType.id]);
                    console.log(`      ↔ product_attribute product_id=${pa.product_id}: [${remapped.join(', ')}]`);
                }
                const [variantRows] = await conn.query(`SELECT id, product_id, attributes FROM product_variants
           WHERE JSON_UNQUOTE(JSON_EXTRACT(attributes, '$."Size"')) = ?`, [sv.value]);
                console.log(`      ${variantRows.length} variant(s) with Size="${sv.value}" to update`);
                for (const vrow of variantRows) {
                    let attrs;
                    try {
                        attrs = typeof vrow.attributes === 'string'
                            ? JSON.parse(vrow.attributes)
                            : vrow.attributes;
                    }
                    catch {
                        console.warn(`      ⚠️  Could not parse attributes for variant id=${vrow.id}`);
                        continue;
                    }
                    attrs['Size'] = normalized;
                    const newAttrsJson = JSON.stringify(attrs);
                    const [dupRows] = await conn.query(`SELECT id FROM product_variants
             WHERE product_id = ? AND attributes = ? AND id != ?`, [vrow.product_id, newAttrsJson, vrow.id]);
                    if (dupRows.length > 0) {
                        await conn.query('DELETE FROM product_variants WHERE id = ?', [vrow.id]);
                        console.log(`      - Deleted duplicate variant id=${vrow.id} (product_id=${vrow.product_id}), kept id=${dupRows[0].id}`);
                    }
                    else {
                        await conn.query('UPDATE product_variants SET attributes = ? WHERE id = ?', [newAttrsJson, vrow.id]);
                        console.log(`      ✓ Updated variant id=${vrow.id}: Size "${sv.value}" → "${normalized}"`);
                    }
                }
                await conn.query('DELETE FROM variant_type_values WHERE id = ?', [sv.id]);
                console.log(`      - Deleted slugged value "${sv.value}" (id=${sv.id})`);
            }
            else {
                console.log(`    → Renaming "${sv.value}" → "${normalized}" in variant_type_values`);
                await conn.query('UPDATE variant_type_values SET value = ? WHERE id = ?', [normalized, sv.id]);
                const [variantRows] = await conn.query(`SELECT id, attributes FROM product_variants
           WHERE JSON_UNQUOTE(JSON_EXTRACT(attributes, '$."Size"')) = ?`, [sv.value]);
                console.log(`      ${variantRows.length} variant(s) with Size="${sv.value}" to update`);
                for (const vrow of variantRows) {
                    let attrs;
                    try {
                        attrs = typeof vrow.attributes === 'string'
                            ? JSON.parse(vrow.attributes)
                            : vrow.attributes;
                    }
                    catch {
                        console.warn(`      ⚠️  Could not parse attributes for variant id=${vrow.id}`);
                        continue;
                    }
                    attrs['Size'] = normalized;
                    await conn.query('UPDATE product_variants SET attributes = ? WHERE id = ?', [JSON.stringify(attrs), vrow.id]);
                    console.log(`      ✓ Updated variant id=${vrow.id}: Size "${sv.value}" → "${normalized}"`);
                }
            }
        }
        console.log('    ✓ Size normalization complete');
    }
    async up() {
        try {
            this.connection = await this.db.getConnection();
            if (!this.connection)
                throw new Error('Failed to get DB connection');
            console.log('\n🚀 Starting migration: Consolidate Product Attributes\n');
            console.log('  Phases:');
            console.log('    1. Merge "Sock X Color" types → "Color"');
            console.log('    2. Merge "Glove Size" type   → "Size"');
            console.log('    3. Normalize "size-X" values → "X"\n');
            console.log('━━━ Phase 1: Merge Sock color types → Color ━━━━━━━━━━━━━━━━━━━━━━━');
            await this.connection.beginTransaction();
            try {
                const [sockColorTypes] = await this.connection.query(`SELECT id, name FROM variant_types WHERE name REGEXP '(?i)sock.*color' OR LOWER(name) LIKE '%sock%color%'`);
                if (sockColorTypes.length === 0) {
                    console.log('  No Sock color types found — skipping phase 1');
                }
                else {
                    for (const st of sockColorTypes) {
                        await this.mergeAttributeType(st.name, 'Color');
                    }
                }
                await this.connection.commit();
                console.log('\n  ✅ Phase 1 committed\n');
            }
            catch (err) {
                await this.connection.rollback();
                throw err;
            }
            console.log('━━━ Phase 2: Merge Glove Size → Size ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            await this.connection.beginTransaction();
            try {
                const [gloveSizeTypes] = await this.connection.query(`SELECT id, name FROM variant_types WHERE LOWER(name) LIKE '%glove%size%' OR LOWER(name) LIKE '%glove size%'`);
                if (gloveSizeTypes.length === 0) {
                    console.log('  No Glove Size types found — skipping phase 2');
                }
                else {
                    for (const gt of gloveSizeTypes) {
                        await this.mergeAttributeType(gt.name, 'Size');
                    }
                }
                await this.connection.commit();
                console.log('\n  ✅ Phase 2 committed\n');
            }
            catch (err) {
                await this.connection.rollback();
                throw err;
            }
            console.log('━━━ Phase 3: Normalize size-X values ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            await this.connection.beginTransaction();
            try {
                await this.normalizeSizeValues();
                await this.connection.commit();
                console.log('\n  ✅ Phase 3 committed\n');
            }
            catch (err) {
                await this.connection.rollback();
                throw err;
            }
            console.log('✅ Migration completed successfully!\n');
        }
        catch (error) {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        }
        finally {
            if (this.connection)
                this.connection.release();
            process.exit(0);
        }
    }
}
new ConsolidateAttributesMigration().up();
//# sourceMappingURL=2026-04-09-consolidate-attributes.js.map