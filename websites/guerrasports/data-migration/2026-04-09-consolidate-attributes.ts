import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Loaded env for:', nodeEnv);

class ConsolidateAttributesMigration {
  private connection: mysql.PoolConnection | null = null;
  private db: any;

  constructor() {
    this.db = require('../src/config/database').db;
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private normalizeVal(s: string): string {
    return s.trim().toLowerCase();
  }

  /**
   * Resolve a variant_type row by exact (case-insensitive) name.
   * Returns null when not found.
   */
  private async getVariantType(name: string): Promise<{ id: number; name: string } | null> {
    const [rows] = await this.connection!.query<any[]>(
      'SELECT id, name FROM variant_types WHERE LOWER(name) = LOWER(?) AND is_active = TRUE LIMIT 1',
      [name]
    );
    return rows.length ? { id: rows[0].id, name: rows[0].name } : null;
  }

  /**
   * All variant_type_values for a given variant_type id.
   */
  private async getValues(variantTypeId: number): Promise<any[]> {
    const [rows] = await this.connection!.query<any[]>(
      'SELECT id, value, color_code, image_url, thumb_url, display_order, is_active, is_preselected FROM variant_type_values WHERE variant_type_id = ?',
      [variantTypeId]
    );
    return rows;
  }

  /**
   * Find an existing value inside targetTypeId whose value text matches (case-insensitive).
   * Returns its id or null.
   */
  private async findValueInType(targetTypeId: number, valueText: string): Promise<number | null> {
    const [rows] = await this.connection!.query<any[]>(
      'SELECT id FROM variant_type_values WHERE variant_type_id = ? AND LOWER(value) = LOWER(?) LIMIT 1',
      [targetTypeId, valueText]
    );
    return rows.length ? rows[0].id : null;
  }

  /**
   * Insert a new value into targetTypeId, copying metadata from sourceRow.
   * Returns the new id.
   */
  private async insertValue(targetTypeId: number, sourceRow: any): Promise<number> {
    const [result] = await this.connection!.query<any>(
      `INSERT INTO variant_type_values
         (variant_type_id, value, color_code, image_url, thumb_url, display_order, is_active, is_preselected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetTypeId,
        sourceRow.value,
        sourceRow.color_code ?? null,
        sourceRow.image_url ?? null,
        sourceRow.thumb_url ?? null,
        sourceRow.display_order ?? 0,
        sourceRow.is_active ?? true,
        sourceRow.is_preselected ?? false,
      ]
    );
    return result.insertId as number;
  }

  /**
   * Parse selected_values JSON (array of numbers) from a product_attributes row.
   */
  private parseSelectedValues(raw: any): number[] {
    if (!raw) return [];
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
    } catch {
      return [];
    }
  }

  // ─── Phase 1 / 2 shared: merge one attribute type into another ──────────────

  /**
   * Merge all source variant_types (matching namePattern) into targetName.
   *
   * Steps:
   *  1. Build oldValueId → newValueId map (creating target values as needed)
   *  2. Update product_attributes: replace source rows with target, merge selected_values
   *  3. Rename JSON key in product_variants.attributes
   *  4. Delete source variant_type (CASCADE removes values)
   */
  private async mergeAttributeType(
    sourceTypeName: string,
    targetTypeName: string
  ): Promise<void> {
    const conn = this.connection!;

    const source = await this.getVariantType(sourceTypeName);
    if (!source) {
      console.log(`  ⚠️  Source type "${sourceTypeName}" not found — skipping`);
      return;
    }

    const target = await this.getVariantType(targetTypeName);
    if (!target) {
      throw new Error(
        `Target type "${targetTypeName}" does not exist in variant_types. ` +
        `Cannot merge "${sourceTypeName}" into it.`
      );
    }

    console.log(`\n  Merging "${source.name}" (id=${source.id}) → "${target.name}" (id=${target.id})`);

    // ── 1. Build value id map ─────────────────────────────────────────────────
    const sourceValues = await this.getValues(source.id);
    console.log(`    Source has ${sourceValues.length} value(s)`);

    const valueIdMap = new Map<number, number>(); // old id → new id

    for (const sv of sourceValues) {
      let newId = await this.findValueInType(target.id, sv.value);
      if (newId === null) {
        newId = await this.insertValue(target.id, sv);
        console.log(`    + Created value "${sv.value}" in "${target.name}" (new id=${newId})`);
      } else {
        console.log(`    = Value "${sv.value}" already exists in "${target.name}" (id=${newId})`);
      }
      valueIdMap.set(sv.id as number, newId);
    }

    // ── 2. Update product_attributes ─────────────────────────────────────────
    const [paRows] = await conn.query<any[]>(
      'SELECT product_id, selected_values FROM product_attributes WHERE variant_type_id = ?',
      [source.id]
    );
    console.log(`    ${paRows.length} product_attributes row(s) to migrate`);

    for (const pa of paRows) {
      const productId = pa.product_id as number;
      const oldSelected = this.parseSelectedValues(pa.selected_values);

      // Remap old IDs → new IDs
      const remapped = oldSelected
        .map(id => valueIdMap.get(id) ?? null)
        .filter((id): id is number => id !== null);

      // Check if the product already has the target type
      const [existingRows] = await conn.query<any[]>(
        'SELECT selected_values FROM product_attributes WHERE product_id = ? AND variant_type_id = ?',
        [productId, target.id]
      );

      if (existingRows.length > 0) {
        // Merge with existing selected_values (deduplicate)
        const existingSelected = this.parseSelectedValues(existingRows[0].selected_values);
        const merged = Array.from(new Set([...existingSelected, ...remapped]));
        await conn.query(
          'UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?',
          [JSON.stringify(merged), productId, target.id]
        );
        console.log(`    ↔ Merged selected_values for product ${productId}: [${merged.join(', ')}]`);
      } else {
        // Insert new product_attributes row for target
        await conn.query(
          'INSERT INTO product_attributes (product_id, variant_type_id, selected_values) VALUES (?, ?, ?)',
          [productId, target.id, JSON.stringify(remapped)]
        );
        console.log(`    + Added product_attribute for product ${productId}, type "${target.name}"`);
      }

      // Delete old product_attributes row
      await conn.query(
        'DELETE FROM product_attributes WHERE product_id = ? AND variant_type_id = ?',
        [productId, source.id]
      );
    }

    // ── 3. Rename JSON key in product_variants.attributes ────────────────────
    // Strategy: for each variant that has the source key, set the target key to
    // COALESCE(existing target value, source value), then remove the source key.
    const [variantRows] = await conn.query<any[]>(
      `SELECT id, attributes FROM product_variants
       WHERE JSON_CONTAINS_PATH(attributes, 'one', ?)`,
      [`$."${source.name}"`]
    );
    console.log(`    ${variantRows.length} product_variant(s) with key "${source.name}" to update`);

    for (const vrow of variantRows) {
      let attrs: Record<string, string>;
      try {
        attrs = typeof vrow.attributes === 'string'
          ? JSON.parse(vrow.attributes)
          : vrow.attributes;
      } catch {
        console.warn(`    ⚠️  Could not parse attributes for variant id=${vrow.id}, skipping`);
        continue;
      }

      const sourceVal = attrs[source.name];
      if (sourceVal === undefined) continue;

      // Keep existing target value if already present; otherwise use source value
      if (!(target.name in attrs)) {
        attrs[target.name] = sourceVal;
      }
      delete attrs[source.name];

      await conn.query(
        'UPDATE product_variants SET attributes = ? WHERE id = ?',
        [JSON.stringify(attrs), vrow.id]
      );
    }

    // ── 4. Delete source variant_type (CASCADE removes its values) ───────────
    await conn.query('DELETE FROM variant_types WHERE id = ?', [source.id]);
    console.log(`    ✓ Deleted source type "${source.name}" (id=${source.id})`);
  }

  // ─── Phase 3: normalize "size-X" → "X" in the Size type ───────────────────

  private async normalizeSizeValues(): Promise<void> {
    const conn = this.connection!;

    const sizeType = await this.getVariantType('Size');
    if (!sizeType) {
      console.log('\n  ⚠️  "Size" attribute type not found — skipping size normalization');
      return;
    }

    console.log(`\n  Normalizing "size-X" values in "${sizeType.name}" (id=${sizeType.id})`);

    const allSizeValues = await this.getValues(sizeType.id);
    // Only process values that look like "size-something"
    const sluggedValues = allSizeValues.filter(v => /^size-/i.test(v.value));

    console.log(`    Found ${sluggedValues.length} slugged value(s) to normalize`);

    for (const sv of sluggedValues) {
      const normalized = sv.value.replace(/^size-/i, '').toUpperCase(); // "size-l" → "L"
      console.log(`\n    Processing: "${sv.value}" (id=${sv.id}) → "${normalized}"`);

      const existingId = await this.findValueInType(sizeType.id, normalized);

      if (existingId !== null && existingId !== sv.id) {
        // "L" already exists — remap everything to it, then delete the slugged row
        console.log(`    = "${normalized}" already exists (id=${existingId}), remapping...`);

        // 3a. Remap product_attributes.selected_values
        const [paRows] = await conn.query<any[]>(
          'SELECT product_id, selected_values FROM product_attributes WHERE variant_type_id = ?',
          [sizeType.id]
        );
        for (const pa of paRows) {
          const sel = this.parseSelectedValues(pa.selected_values);
          if (!sel.includes(sv.id as number)) continue;

          const remapped = Array.from(
            new Set(sel.map(id => (id === sv.id ? existingId : id)))
          );
          await conn.query(
            'UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?',
            [JSON.stringify(remapped), pa.product_id, sizeType.id]
          );
          console.log(`      ↔ product_attribute product_id=${pa.product_id}: [${remapped.join(', ')}]`);
        }

        // 3b. Update product_variants.attributes: change Size value from old slug to normalized
        const [variantRows] = await conn.query<any[]>(
          `SELECT id, product_id, attributes FROM product_variants
           WHERE JSON_UNQUOTE(JSON_EXTRACT(attributes, '$."Size"')) = ?`,
          [sv.value]
        );
        console.log(`      ${variantRows.length} variant(s) with Size="${sv.value}" to update`);

        for (const vrow of variantRows) {
          let attrs: Record<string, string>;
          try {
            attrs = typeof vrow.attributes === 'string'
              ? JSON.parse(vrow.attributes)
              : vrow.attributes;
          } catch {
            console.warn(`      ⚠️  Could not parse attributes for variant id=${vrow.id}`);
            continue;
          }

          attrs['Size'] = normalized;
          const newAttrsJson = JSON.stringify(attrs);

          // Check if another variant with the same (product_id, attributes) already exists
          const [dupRows] = await conn.query<any[]>(
            `SELECT id FROM product_variants
             WHERE product_id = ? AND attributes = ? AND id != ?`,
            [vrow.product_id, newAttrsJson, vrow.id]
          );

          if (dupRows.length > 0) {
            // Duplicate after normalization — delete this (old-slug) variant
            await conn.query('DELETE FROM product_variants WHERE id = ?', [vrow.id]);
            console.log(`      - Deleted duplicate variant id=${vrow.id} (product_id=${vrow.product_id}), kept id=${dupRows[0].id}`);
          } else {
            await conn.query(
              'UPDATE product_variants SET attributes = ? WHERE id = ?',
              [newAttrsJson, vrow.id]
            );
            console.log(`      ✓ Updated variant id=${vrow.id}: Size "${sv.value}" → "${normalized}"`);
          }
        }

        // 3c. Delete the now-unused slugged variant_type_value
        await conn.query('DELETE FROM variant_type_values WHERE id = ?', [sv.id]);
        console.log(`      - Deleted slugged value "${sv.value}" (id=${sv.id})`);

      } else {
        // "L" does not exist yet — rename the slugged value in-place
        console.log(`    → Renaming "${sv.value}" → "${normalized}" in variant_type_values`);

        await conn.query(
          'UPDATE variant_type_values SET value = ? WHERE id = ?',
          [normalized, sv.id]
        );

        // Update product_variants.attributes
        const [variantRows] = await conn.query<any[]>(
          `SELECT id, attributes FROM product_variants
           WHERE JSON_UNQUOTE(JSON_EXTRACT(attributes, '$."Size"')) = ?`,
          [sv.value]
        );
        console.log(`      ${variantRows.length} variant(s) with Size="${sv.value}" to update`);

        for (const vrow of variantRows) {
          let attrs: Record<string, string>;
          try {
            attrs = typeof vrow.attributes === 'string'
              ? JSON.parse(vrow.attributes)
              : vrow.attributes;
          } catch {
            console.warn(`      ⚠️  Could not parse attributes for variant id=${vrow.id}`);
            continue;
          }
          attrs['Size'] = normalized;
          await conn.query(
            'UPDATE product_variants SET attributes = ? WHERE id = ?',
            [JSON.stringify(attrs), vrow.id]
          );
          console.log(`      ✓ Updated variant id=${vrow.id}: Size "${sv.value}" → "${normalized}"`);
        }
      }
    }

    console.log('    ✓ Size normalization complete');
  }

  // ─── Entry point ────────────────────────────────────────────────────────────

  async up(): Promise<void> {
    try {
      this.connection = await this.db.getConnection();
      if (!this.connection) throw new Error('Failed to get DB connection');

      console.log('\n🚀 Starting migration: Consolidate Product Attributes\n');
      console.log('  Phases:');
      console.log('    1. Merge "Sock X Color" types → "Color"');
      console.log('    2. Merge "Glove Size" type   → "Size"');
      console.log('    3. Normalize "size-X" values → "X"\n');

      // ── Phase 1: Merge Sock color types into Color ────────────────────────
      console.log('━━━ Phase 1: Merge Sock color types → Color ━━━━━━━━━━━━━━━━━━━━━━━');
      await this.connection.beginTransaction();
      try {
        // Find all variant_types whose name matches /sock.*color/i
        const [sockColorTypes] = await this.connection.query<any[]>(
          `SELECT id, name FROM variant_types WHERE name REGEXP '(?i)sock.*color' OR LOWER(name) LIKE '%sock%color%'`
        );
        if (sockColorTypes.length === 0) {
          console.log('  No Sock color types found — skipping phase 1');
        } else {
          for (const st of sockColorTypes) {
            await this.mergeAttributeType(st.name, 'Color');
          }
        }
        await this.connection.commit();
        console.log('\n  ✅ Phase 1 committed\n');
      } catch (err) {
        await this.connection.rollback();
        throw err;
      }

      // ── Phase 2: Merge Glove Size into Size ───────────────────────────────
      console.log('━━━ Phase 2: Merge Glove Size → Size ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await this.connection.beginTransaction();
      try {
        const [gloveSizeTypes] = await this.connection.query<any[]>(
          `SELECT id, name FROM variant_types WHERE LOWER(name) LIKE '%glove%size%' OR LOWER(name) LIKE '%glove size%'`
        );
        if (gloveSizeTypes.length === 0) {
          console.log('  No Glove Size types found — skipping phase 2');
        } else {
          for (const gt of gloveSizeTypes) {
            await this.mergeAttributeType(gt.name, 'Size');
          }
        }
        await this.connection.commit();
        console.log('\n  ✅ Phase 2 committed\n');
      } catch (err) {
        await this.connection.rollback();
        throw err;
      }

      // ── Phase 3: Normalize "size-X" values ───────────────────────────────
      console.log('━━━ Phase 3: Normalize size-X values ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await this.connection.beginTransaction();
      try {
        await this.normalizeSizeValues();
        await this.connection.commit();
        console.log('\n  ✅ Phase 3 committed\n');
      } catch (err) {
        await this.connection.rollback();
        throw err;
      }

      console.log('✅ Migration completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    } finally {
      if (this.connection) this.connection.release();
      process.exit(0);
    }
  }
}

new ConsolidateAttributesMigration().up();
