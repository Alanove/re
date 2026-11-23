/**
 * Migration: Normalize product_variants.attributes JSON
 *
 * Problem: legacy variants were stored with lowercase keys and slug values, e.g.
 *   {"color": "heather-grey", "size": "size-l"}
 * instead of the canonical form used by the display service, e.g.
 *   {"Color": "Heather Grey", "Size": "L"}
 *
 * The display service queries product_attributes.selected_values for the canonical
 * values AND product_variants.attributes for actual options, then deduplicates by
 * normalized value.  Because "size-l".toLowerCase() !== "l" (canonical "L".toLowerCase()),
 * both appear as separate options on the PDP.
 *
 * Fix:
 *  1. Build a lookup map: variant_type_id → {canonical type name, [canonical values]}
 *  2. For every product_variant row, parse the JSON, remap each key to its canonical
 *     type name and each value to its canonical display value.
 *  3. If the remapped JSON would duplicate an already-correct variant in the same
 *     product, delete the legacy variant (keep the canonical one).
 *  4. Otherwise, UPDATE the row with the fixed JSON.
 *
 * Value matching strategies (tried in order):
 *  a. Case-insensitive exact match            "black"       → "Black"
 *  b. Replace dashes with spaces, then match  "heather-grey" → "Heather Grey"
 *  c. Strip "size-" prefix, try again         "size-l"      → "L"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Loaded env for:', nodeEnv);

class NormalizeVariantAttributesMigration {
  private connection: any = null;
  private db: any;

  // variant_type_id → { canonicalName: string, values: Array<{id, value}> }
  private typeMap = new Map<number, { canonicalName: string; values: Array<{ id: number; value: string }> }>();
  // lowercase canonical name → variant_type_id
  private typeByNormName = new Map<string, number>();

  constructor() {
    this.db = require('../src/config/database').db;
  }

  // ─── matching helpers ────────────────────────────────────────────────────

  /**
   * Try to find the canonical display value for a slugged/lowercase value.
   * Returns the canonical string if found, null otherwise.
   */
  private findCanonical(slugValue: string, typeId: number): string | null {
    const type = this.typeMap.get(typeId);
    if (!type) return null;

    const slug = slugValue.trim();
    const slugLower = slug.toLowerCase();

    // Strategy 1: direct case-insensitive exact match
    for (const cv of type.values) {
      if (cv.value.toLowerCase() === slugLower) return cv.value;
    }

    // Strategy 2: replace dashes with spaces, then case-insensitive match
    const withSpaces = slugLower.replace(/-/g, ' ');
    for (const cv of type.values) {
      if (cv.value.toLowerCase() === withSpaces) return cv.value;
    }

    // Strategy 3: strip leading "size-" prefix, then retry strategies 1 & 2
    if (/^size-/i.test(slug)) {
      const stripped = slug.replace(/^size-/i, '').trim();
      const strippedLower = stripped.toLowerCase();
      for (const cv of type.values) {
        if (cv.value.toLowerCase() === strippedLower) return cv.value;
        if (cv.value.toLowerCase() === strippedLower.replace(/-/g, ' ')) return cv.value;
      }
    }

    return null;
  }

  // ─── setup ──────────────────────────────────────────────────────────────

  private async loadTypeMaps(): Promise<void> {
    const [types] = await this.connection.query(
      'SELECT id, name FROM variant_types WHERE is_active = TRUE'
    ) as any[];
    for (const t of (types as any[])) {
      const [vals] = await this.connection.query(
        'SELECT id, value FROM variant_type_values WHERE variant_type_id = ? ORDER BY display_order, value',
        [t.id]
      ) as any[];
      this.typeMap.set(t.id, { canonicalName: t.name, values: vals });
      this.typeByNormName.set(t.name.toLowerCase(), t.id);
    }
    console.log(`  Loaded ${this.typeMap.size} attribute type(s) into lookup map`);
  }

  // ─── core fix ───────────────────────────────────────────────────────────

  private async fixVariants(): Promise<void> {
    const conn = this.connection;

    // Load ALL variants (we read the full row set once to avoid repeated queries)
    const [variants] = await conn.query(
      'SELECT id, product_id, attributes FROM product_variants ORDER BY product_id, id'
    ) as any[];
    console.log(`  Total variants to inspect: ${variants.length}`);

    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    let unmapped = 0;

    // Group by product_id so we can detect duplicates within the same product
    const byProduct = new Map<number, Array<{ id: number; attrsJson: string }>>();

    for (const v of variants) {
      const pid = v.product_id as number;
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid)!.push({ id: v.id, attrsJson: v.attributes as string });
    }

    for (const v of variants) {
      let attrs: Record<string, string>;
      try {
        attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
      } catch {
        console.warn(`  ⚠️  Cannot parse attributes for variant id=${v.id} — skipping`);
        continue;
      }

      const newAttrs: Record<string, string> = {};
      let anyChange = false;
      let anyUnmapped = false;

      for (const [rawKey, rawVal] of Object.entries(attrs)) {
        // Resolve canonical type name from key (case-insensitive)
        const typeId = this.typeByNormName.get(rawKey.toLowerCase());
        const canonicalKey = typeId !== undefined
          ? this.typeMap.get(typeId)!.canonicalName
          : rawKey; // unknown type: keep as-is

        if (typeId !== undefined) {
          // Resolve canonical value
          const canonical = this.findCanonical(rawVal, typeId);
          if (canonical !== null) {
            newAttrs[canonicalKey] = canonical;
            if (rawKey !== canonicalKey || rawVal !== canonical) anyChange = true;
          } else {
            // Value not found in variant_type_values — keep as-is but log
            newAttrs[canonicalKey] = rawVal;
            if (rawKey !== canonicalKey) anyChange = true;
            console.warn(`    ⚠️  Variant id=${v.id}: no canonical match for ${rawKey}="${rawVal}" — kept as "${canonicalKey}"="${rawVal}"`);
            anyUnmapped = true;
          }
        } else {
          // Unknown attribute key — keep as-is
          newAttrs[rawKey] = rawVal;
          console.warn(`    ⚠️  Variant id=${v.id}: unknown attribute key "${rawKey}" — kept as-is`);
        }
      }

      if (anyUnmapped) unmapped++;
      if (!anyChange) { unchanged++; continue; }

      const newJson = JSON.stringify(newAttrs);

      // Check if another variant in the same product already has this exact JSON
      const siblings = byProduct.get(v.product_id as number) ?? [];
      const duplicate = siblings.find(s => s.id !== v.id && s.attrsJson === newJson);

      if (duplicate) {
        // The canonical variant already exists — delete this legacy one
        await conn.query('DELETE FROM product_variants WHERE id = ?', [v.id]);
        console.log(`  - Deleted duplicate variant id=${v.id} (product_id=${v.product_id}), kept id=${duplicate.id}`);
        deleted++;
        // Remove from the in-memory list so subsequent siblings don't think it still exists
        const idx = siblings.findIndex(s => s.id === v.id);
        if (idx >= 0) siblings.splice(idx, 1);
      } else {
        await conn.query('UPDATE product_variants SET attributes = ? WHERE id = ?', [newJson, v.id]);
        console.log(`  ✓ Updated variant id=${v.id} (product_id=${v.product_id}): ${v.attributes} → ${newJson}`);
        updated++;
        // Update in-memory list for duplicate detection in subsequent iterations
        const entry = siblings.find(s => s.id === v.id);
        if (entry) entry.attrsJson = newJson;
      }
    }

    console.log(`\n  Summary:`);
    console.log(`    Updated : ${updated}`);
    console.log(`    Deleted (duplicates): ${deleted}`);
    console.log(`    Unchanged: ${unchanged}`);
    if (unmapped > 0) console.log(`    Variants with unmapped values: ${unmapped} (check warnings above)`);
  }

  // ─── entry point ────────────────────────────────────────────────────────

  async up(): Promise<void> {
    try {
      this.connection = await this.db.getConnection();
      if (!this.connection) throw new Error('Failed to get DB connection');

      console.log('\n🚀 Starting migration: Normalize product_variants.attributes JSON\n');

      await this.loadTypeMaps();

      await this.connection.beginTransaction();
      try {
        await this.fixVariants();
        await this.connection.commit();
        console.log('\n  ✅ Transaction committed');
      } catch (err) {
        await this.connection.rollback();
        throw err;
      }

      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    } finally {
      if (this.connection) this.connection.release();
      process.exit(0);
    }
  }
}

new NormalizeVariantAttributesMigration().up();
