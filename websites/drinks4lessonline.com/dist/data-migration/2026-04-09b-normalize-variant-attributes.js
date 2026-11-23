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
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('Loaded env for:', nodeEnv);
class NormalizeVariantAttributesMigration {
    constructor() {
        this.connection = null;
        this.typeMap = new Map();
        this.typeByNormName = new Map();
        this.db = require('../src/config/database').db;
    }
    findCanonical(slugValue, typeId) {
        const type = this.typeMap.get(typeId);
        if (!type)
            return null;
        const slug = slugValue.trim();
        const slugLower = slug.toLowerCase();
        for (const cv of type.values) {
            if (cv.value.toLowerCase() === slugLower)
                return cv.value;
        }
        const withSpaces = slugLower.replace(/-/g, ' ');
        for (const cv of type.values) {
            if (cv.value.toLowerCase() === withSpaces)
                return cv.value;
        }
        if (/^size-/i.test(slug)) {
            const stripped = slug.replace(/^size-/i, '').trim();
            const strippedLower = stripped.toLowerCase();
            for (const cv of type.values) {
                if (cv.value.toLowerCase() === strippedLower)
                    return cv.value;
                if (cv.value.toLowerCase() === strippedLower.replace(/-/g, ' '))
                    return cv.value;
            }
        }
        return null;
    }
    async loadTypeMaps() {
        const [types] = await this.connection.query('SELECT id, name FROM variant_types WHERE is_active = TRUE');
        for (const t of types) {
            const [vals] = await this.connection.query('SELECT id, value FROM variant_type_values WHERE variant_type_id = ? ORDER BY display_order, value', [t.id]);
            this.typeMap.set(t.id, { canonicalName: t.name, values: vals });
            this.typeByNormName.set(t.name.toLowerCase(), t.id);
        }
        console.log(`  Loaded ${this.typeMap.size} attribute type(s) into lookup map`);
    }
    async fixVariants() {
        const conn = this.connection;
        const [variants] = await conn.query('SELECT id, product_id, attributes FROM product_variants ORDER BY product_id, id');
        console.log(`  Total variants to inspect: ${variants.length}`);
        let updated = 0;
        let deleted = 0;
        let unchanged = 0;
        let unmapped = 0;
        const byProduct = new Map();
        for (const v of variants) {
            const pid = v.product_id;
            if (!byProduct.has(pid))
                byProduct.set(pid, []);
            byProduct.get(pid).push({ id: v.id, attrsJson: v.attributes });
        }
        for (const v of variants) {
            let attrs;
            try {
                attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
            }
            catch {
                console.warn(`  ⚠️  Cannot parse attributes for variant id=${v.id} — skipping`);
                continue;
            }
            const newAttrs = {};
            let anyChange = false;
            let anyUnmapped = false;
            for (const [rawKey, rawVal] of Object.entries(attrs)) {
                const typeId = this.typeByNormName.get(rawKey.toLowerCase());
                const canonicalKey = typeId !== undefined
                    ? this.typeMap.get(typeId).canonicalName
                    : rawKey;
                if (typeId !== undefined) {
                    const canonical = this.findCanonical(rawVal, typeId);
                    if (canonical !== null) {
                        newAttrs[canonicalKey] = canonical;
                        if (rawKey !== canonicalKey || rawVal !== canonical)
                            anyChange = true;
                    }
                    else {
                        newAttrs[canonicalKey] = rawVal;
                        if (rawKey !== canonicalKey)
                            anyChange = true;
                        console.warn(`    ⚠️  Variant id=${v.id}: no canonical match for ${rawKey}="${rawVal}" — kept as "${canonicalKey}"="${rawVal}"`);
                        anyUnmapped = true;
                    }
                }
                else {
                    newAttrs[rawKey] = rawVal;
                    console.warn(`    ⚠️  Variant id=${v.id}: unknown attribute key "${rawKey}" — kept as-is`);
                }
            }
            if (anyUnmapped)
                unmapped++;
            if (!anyChange) {
                unchanged++;
                continue;
            }
            const newJson = JSON.stringify(newAttrs);
            const siblings = byProduct.get(v.product_id) ?? [];
            const duplicate = siblings.find(s => s.id !== v.id && s.attrsJson === newJson);
            if (duplicate) {
                await conn.query('DELETE FROM product_variants WHERE id = ?', [v.id]);
                console.log(`  - Deleted duplicate variant id=${v.id} (product_id=${v.product_id}), kept id=${duplicate.id}`);
                deleted++;
                const idx = siblings.findIndex(s => s.id === v.id);
                if (idx >= 0)
                    siblings.splice(idx, 1);
            }
            else {
                await conn.query('UPDATE product_variants SET attributes = ? WHERE id = ?', [newJson, v.id]);
                console.log(`  ✓ Updated variant id=${v.id} (product_id=${v.product_id}): ${v.attributes} → ${newJson}`);
                updated++;
                const entry = siblings.find(s => s.id === v.id);
                if (entry)
                    entry.attrsJson = newJson;
            }
        }
        console.log(`\n  Summary:`);
        console.log(`    Updated : ${updated}`);
        console.log(`    Deleted (duplicates): ${deleted}`);
        console.log(`    Unchanged: ${unchanged}`);
        if (unmapped > 0)
            console.log(`    Variants with unmapped values: ${unmapped} (check warnings above)`);
    }
    async up() {
        try {
            this.connection = await this.db.getConnection();
            if (!this.connection)
                throw new Error('Failed to get DB connection');
            console.log('\n🚀 Starting migration: Normalize product_variants.attributes JSON\n');
            await this.loadTypeMaps();
            await this.connection.beginTransaction();
            try {
                await this.fixVariants();
                await this.connection.commit();
                console.log('\n  ✅ Transaction committed');
            }
            catch (err) {
                await this.connection.rollback();
                throw err;
            }
            console.log('\n✅ Migration completed successfully!\n');
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
new NormalizeVariantAttributesMigration().up();
//# sourceMappingURL=2026-04-09b-normalize-variant-attributes.js.map