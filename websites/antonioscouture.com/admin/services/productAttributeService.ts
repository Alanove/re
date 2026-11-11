import { db } from '../../src/config/database';
import * as mysql from 'mysql2/promise';

export interface ProductAttribute {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  has_image: boolean;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  values?: ProductAttributeValue[];
  selected_values?: number[]; // IDs of selected values
}

export interface ProductAttributeValue {
  id: number;
  variant_type_id: number;
  value: string;
  color_code: string | null;
  display_order: number;
  is_active: boolean;
  is_preselected: boolean;
  created_at: Date;
  updated_at: Date;
  /** Resolved URL (product_images for this product, else variant_type_values.image_url) */
  image_url?: string | null;
  /** Small image for swatches / listings when available */
  thumb_url?: string | null;
}

export interface ProductAttributeData {
  name: string;
  slug?: string;
  description?: string;
  has_image?: boolean;
  display_order?: number;
  is_active?: boolean;
  values?: string[]; // Array of value strings
}

export class ProductAttributeService {
  private static instance: ProductAttributeService;

  private constructor() { }

  public static getInstance(): ProductAttributeService {
    if (!ProductAttributeService.instance) {
      ProductAttributeService.instance = new ProductAttributeService();
    }
    return ProductAttributeService.instance;
  }

  /**
   * Get all product attributes with their values
   */
  public async getAllProductAttributes(includeInactive: boolean = false): Promise<ProductAttribute[]> {
    try {
      const whereClause = includeInactive ? '' : 'WHERE vt.is_active = TRUE';
      const [rows] = await db.query<any>(
        `SELECT 
          vt.*,
          GROUP_CONCAT(
            CONCAT(vtv.id, ':', vtv.value, ':', IFNULL(vtv.color_code, ''), ':', vtv.display_order, ':', vtv.is_active, ':', vtv.is_preselected)
            ORDER BY vtv.display_order, vtv.value
            SEPARATOR '|'
          ) as values_data
        FROM variant_types vt
        LEFT JOIN variant_type_values vtv ON vt.id = vtv.variant_type_id ${includeInactive ? '' : 'AND vtv.is_active = TRUE'}
        ${whereClause}
        GROUP BY vt.id
        ORDER BY vt.display_order, vt.name`,
        []
      );

      return rows.map((row: any) => {
        const productAttribute: ProductAttribute = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          has_image: row.has_image === 1 || row.has_image === true,
          display_order: row.display_order,
          is_active: row.is_active === 1 || row.is_active === true,
          created_at: row.created_at,
          updated_at: row.updated_at,
          values: []
        };

        if (row.values_data) {
          productAttribute.values = row.values_data.split('|').map((valStr: string) => {
            const [id, value, color_code, display_order, is_active, is_preselected] = valStr.split(':');
            return {
              id: parseInt(id),
              variant_type_id: row.id,
              value,
              color_code: color_code || null,
              display_order: parseInt(display_order),
              is_active: is_active === '1' || is_active === 'true',
              is_preselected: is_preselected === '1' || is_preselected === 'true',
              created_at: new Date(),
              updated_at: new Date()
            };
          });
        }

        return productAttribute;
      });
    } catch (error) {
      console.error('Error getting product attributes:', error);
      throw error;
    }
  }

  /**
   * Get product attribute by ID
   */
  public async getProductAttributeById(id: number): Promise<ProductAttribute | null> {
    try {
      const [rows] = await db.query<any>(
        `SELECT * FROM variant_types WHERE id = ?`,
        [id]
      );

      if (rows.length === 0) return null;

      const productAttribute = rows[0] as unknown as any;
      productAttribute.has_image = productAttribute.has_image === 1 || productAttribute.has_image === true;
      productAttribute.is_active = productAttribute.is_active === 1 || productAttribute.is_active === true;

      // Get values with explicit columns so color_code is always read correctly
      const [valueRows] = await db.query<any>(
        `SELECT id, variant_type_id, value, color_code, display_order, is_active, is_preselected, image_url, created_at, updated_at
         FROM variant_type_values 
         WHERE variant_type_id = ? 
         ORDER BY display_order, value`,
        [id]
      );

      productAttribute.values = valueRows.map((v: any) => {
        const rawColor = v.color_code;
        const colorCode = (typeof rawColor === 'string' && rawColor.trim()) ? rawColor.trim() : null;
        return {
          ...v,
          is_active: v.is_active === 1 || v.is_active === true,
          is_preselected: v.is_preselected === 1 || v.is_preselected === true,
          color_code: colorCode
        };
      });

      return productAttribute;
    } catch (error) {
      console.error('Error getting product attribute:', error);
      throw error;
    }
  }

  /**
   * Create product attribute
   */
  public async createProductAttribute(data: ProductAttributeData): Promise<number> {
    try {
      const slug = data.slug || this.generateSlug(data.name);

      // Create product attribute
      const [result] = await db.query(
        `INSERT INTO variant_types (name, slug, description, has_image, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.slug || this.generateSlug(data.name),
          data.description || null,
          data.has_image !== undefined ? data.has_image : false,
          data.display_order || 0,
          data.is_active !== undefined ? data.is_active : true
        ]
      );

      const productAttributeId = (result as any).insertId;

      // Add values if provided
      if (data.values && data.values.length > 0) {
        await this.addProductAttributeValues(productAttributeId, data.values);
      }

      return productAttributeId;
    } catch (error) {
      console.error('Error creating product attribute:', error);
      throw error;
    }
  }

  /**
   * Update product attribute
   */
  public async updateProductAttribute(id: number, data: Partial<ProductAttributeData>): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.slug !== undefined) {
        updates.push('slug = ?');
        values.push(data.slug);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }

      if (data.has_image !== undefined) {
        updates.push('has_image = ?');
        values.push(data.has_image);
      }

      if (data.display_order !== undefined) {
        updates.push('display_order = ?');
        values.push(data.display_order);
      }

      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(data.is_active);
      }

      if (updates.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE variant_types SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }

      // Update values if provided
      if (data.values !== undefined) {
        // Delete existing values
        await db.query('DELETE FROM variant_type_values WHERE variant_type_id = ?', [id]);
        // Add new values
        if (data.values.length > 0) {
          await this.addProductAttributeValues(id, data.values);
        }
      }
    } catch (error) {
      console.error('Error updating product attribute:', error);
      throw error;
    }
  }

  /**
   * Delete product attribute
   */
  public async deleteProductAttribute(id: number): Promise<void> {
    try {
      // Values will be deleted via CASCADE
      await db.query('DELETE FROM variant_types WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting product attribute:', error);
      throw error;
    }
  }

  /**
   * Add values to product attribute
   */
  private async addProductAttributeValues(productAttributeId: number, values: string[]): Promise<void> {
    try {
      for (let i = 0; i < values.length; i++) {
        const value = values[i].trim();
        if (value) {
          await db.query(
            `INSERT INTO variant_type_values (variant_type_id, value, display_order, is_active)
             VALUES (?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE value = VALUES(value), is_active = TRUE`,
            [productAttributeId, value, i]
          );
        }
      }
    } catch (error) {
      console.error('Error adding product attribute values:', error);
      throw error;
    }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get product attributes that can have images
   */
  public async getProductAttributesWithImages(): Promise<ProductAttribute[]> {
    try {
      const allAttributes = await this.getAllProductAttributes();
      return allAttributes.filter(attr => attr.has_image);
    } catch (error) {
      console.error('Error getting product attributes with images:', error);
      throw error;
    }
  }

  /**
   * Check if attribute is used by any products
   * Returns array of product names using this attribute
   */
  public async checkAttributeUsage(attributeName: string): Promise<string[]> {
    try {
      // Use JSON_CONTAINS_PATH to check if the attribute name exists as a key in the attributes JSON
      // Note: We're checking the attributes column in product_variants table
      // AND ensuring the product is not deleted (though products table doesn't seem to have soft delete)
      const [rows] = await db.query<any>(
        `SELECT DISTINCT p.name 
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE JSON_contains_path(pv.attributes, 'one', concat('$."', ?, '"'))`,
        [attributeName]
      );

      return rows.map(row => row.name);
    } catch (error) {
      console.error('Error checking attribute usage:', error);
      // Fallback: If JSON functions aren't supported or error occurs, log and allow (or safer to block? defaulting to empty for now)
      return [];
    }
  }

  /**
   * Update a specific attribute value with detailed properties
   */
  public async updateAttributeValue(
    valueId: number,
    data: {
      value?: string;
      color_code?: string | null;
      display_order?: number;
      is_active?: boolean;
      is_preselected?: boolean;
    }
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.value !== undefined) {
        updates.push('value = ?');
        values.push(data.value);
      }
      if (data.color_code !== undefined) {
        updates.push('color_code = ?');
        const normalized = (typeof data.color_code === 'string' && data.color_code.trim()) ? data.color_code.trim() : null;
        values.push(normalized);
      }
      if (data.display_order !== undefined) {
        updates.push('display_order = ?');
        values.push(data.display_order);
      }
      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(data.is_active);
      }
      if (data.is_preselected !== undefined) {
        updates.push('is_preselected = ?');
        values.push(data.is_preselected);
      }

      if (updates.length > 0) {
        values.push(valueId);
        await db.query(
          `UPDATE variant_type_values SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
          values
        );
      }
    } catch (error) {
      console.error('Error updating attribute value:', error);
      throw error;
    }
  }

  /**
   * Check if attribute value is used by any products
   */
  public async checkAttributeValueUsage(valueId: number): Promise<string[]> {
    try {
      // Get the value and its attribute name
      const [valueRows] = await db.query<any>(
        `SELECT vtv.value, vt.name as attribute_name 
         FROM variant_type_values vtv 
         JOIN variant_types vt ON vtv.variant_type_id = vt.id 
         WHERE vtv.id = ?`,
        [valueId]
      );

      if (valueRows.length === 0) return [];

      const { value, attribute_name } = valueRows[0];

      // Check usage in product variants
      // Use JSON_EXTRACT to check specific key-value pair
      const [rows] = await db.query<any>(
        `SELECT DISTINCT p.name 
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE JSON_UNQUOTE(JSON_EXTRACT(pv.attributes, concat('$."', ?, '"'))) = ?`,
        [attribute_name, value]
      );

      return rows.map(row => row.name);
    } catch (error) {
      console.error('Error checking attribute value usage:', error);
      return [];
    }
  }

  /**
   * Add a new attribute value with detailed properties
   */
  public async addAttributeValue(
    variantTypeId: number,
    data: {
      value: string;
      color_code?: string | null;
      display_order?: number;
      is_active?: boolean;
      is_preselected?: boolean;
    }
  ): Promise<number> {
    try {
      const [result] = await db.query(
        `INSERT INTO variant_type_values 
         (variant_type_id, value, color_code, display_order, is_active, is_preselected)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          variantTypeId,
          data.value,
          data.color_code || null,
          data.display_order || 0,
          data.is_active !== undefined ? data.is_active : true,
          data.is_preselected !== undefined ? data.is_preselected : false
        ]
      );
      return (result as unknown as mysql.ResultSetHeader).insertId;
    } catch (error) {
      console.error('Error adding attribute value:', error);
      throw error;
    }
  }

  /**
   * Delete an attribute value
   */
  public async deleteAttributeValue(valueId: number): Promise<void> {
    try {
      // Check usage first
      const usedByProducts = await this.checkAttributeValueUsage(valueId);
      if (usedByProducts.length > 0) {
        const topProducts = usedByProducts.slice(0, 5);
        const moreCount = usedByProducts.length - 5;
        const productList = topProducts.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '');

        // Get value name for better error message
        const [valueRows] = await db.query<any>('SELECT value FROM variant_type_values WHERE id = ?', [valueId]);
        const valueName = valueRows[0]?.value || 'Unknown';

        throw new Error(`Current attribute value "${valueName}" is used by products: ${productList}`);
      }

      await db.query('DELETE FROM variant_type_values WHERE id = ?', [valueId]);
    } catch (error) {
      console.error('Error deleting attribute value:', error);
      throw error;
    }
  }

  /**
   * Update all values for a product attribute (for edit form)
   */
  public async updateAttributeValues(
    variantTypeId: number,
    values: Array<{
      id?: number;
      value: string;
      color_code?: string | null;
      display_order?: number;
      is_active?: boolean;
      is_preselected?: boolean;
    }>
  ): Promise<void> {
    try {
      // Get existing values
      const [existingValues] = await db.query<any>(
        'SELECT id FROM variant_type_values WHERE variant_type_id = ?',
        [variantTypeId]
      );
      const existingIds = existingValues.map(v => v.id);
      const providedIds = values.filter(v => v.id).map(v => v.id!);

      // Delete values that are not in the provided list
      const toDelete = existingIds.filter((id: number) => !providedIds.includes(id));
      for (const id of toDelete) {
        await this.deleteAttributeValue(id);
      }

      // Update or insert values
      for (const value of values) {
        if (value.id) {
          // Update existing value
          await this.updateAttributeValue(value.id, value);
        } else {
          // Insert new value
          await this.addAttributeValue(variantTypeId, value);
        }
      }
    } catch (error) {
      console.error('Error updating attribute values:', error);
      throw error;
    }
  }

  /**
   * Upload image for attribute value
   */
  public async uploadAttributeValueImage(
    valueId: number,
    imageUrl: string,
    thumbUrl?: string | null
  ): Promise<void> {
    try {
      await db.query(
        'UPDATE variant_type_values SET image_url = ?, thumb_url = ? WHERE id = ?',
        [imageUrl, thumbUrl ?? null, valueId]
      );
    } catch (error) {
      console.error('Error uploading attribute value image:', error);
      throw error;
    }
  }

  /**
   * Delete image for attribute value
   */
  public async deleteAttributeValueImage(valueId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE variant_type_values SET image_url = NULL, thumb_url = NULL WHERE id = ?',
        [valueId]
      );
    } catch (error) {
      console.error('Error deleting attribute value image:', error);
      throw error;
    }
  }

  /**
   * Get product's selected attributes with values and images
   * (Flat query + in-memory grouping — avoids GROUP_CONCAT/split breaking URLs that contain ":".)
   */
  public async getProductAttributes(productId: number): Promise<ProductAttribute[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT 
          vt.id AS variant_type_id,
          vt.name,
          vt.slug,
          vt.description,
          vt.has_image,
          vt.display_order,
          vt.is_active,
          vt.created_at,
          vt.updated_at,
          pa.selected_values,
          vtv.id AS value_id,
          vtv.value AS value_text,
          vtv.color_code,
          vtv.display_order AS value_display_order,
          vtv.is_active AS value_is_active,
          vtv.is_preselected,
          vtv.created_at AS value_created_at,
          vtv.updated_at AS value_updated_at,
          vtv.image_url AS vtv_image_url,
          vtv.thumb_url AS vtv_thumb_url,
          pi.image_url AS product_image_url,
          pi.thumb_url AS product_thumb_url
        FROM product_attributes pa
        JOIN variant_types vt ON pa.variant_type_id = vt.id
        LEFT JOIN variant_type_values vtv ON vt.id = vtv.variant_type_id AND vtv.is_active = TRUE
        LEFT JOIN (
          SELECT attribute_value_id,
            ANY_VALUE(image_url) AS image_url,
            ANY_VALUE(thumb_url) AS thumb_url
          FROM product_images
          WHERE product_id = ?
            AND attribute_value_id IS NOT NULL
          GROUP BY attribute_value_id
        ) pi ON pi.attribute_value_id = vtv.id
        WHERE pa.product_id = ? AND vt.is_active = TRUE
        ORDER BY vt.display_order, vt.name, vtv.display_order, vtv.value`,
        [productId, productId]
      );

      const byType = new Map<number, ProductAttribute>();

      for (const row of rows) {
        const typeId = row.variant_type_id as number;
        if (!byType.has(typeId)) {
          let selected: number[] = [];
          try {
            const raw = row.selected_values;
            selected =
              typeof raw === 'string' ? JSON.parse(raw || '[]') : Array.isArray(raw) ? raw : [];
          } catch {
            selected = [];
          }
          byType.set(typeId, {
            id: typeId,
            name: row.name,
            slug: row.slug,
            description: row.description,
            has_image: row.has_image === 1 || row.has_image === true,
            display_order: row.display_order,
            is_active: row.is_active === 1 || row.is_active === true,
            created_at: row.created_at,
            updated_at: row.updated_at,
            values: [],
            selected_values: selected
          });
        }

        if (row.value_id != null) {
          const attr = byType.get(typeId)!;
          const fromProduct = row.product_image_url && String(row.product_image_url).trim();
          const fromVtv = row.vtv_image_url && String(row.vtv_image_url).trim();
          const imageUrl = (fromProduct || fromVtv || '').trim() || null;
          const tp = row.product_thumb_url && String(row.product_thumb_url).trim();
          const tv = row.vtv_thumb_url && String(row.vtv_thumb_url).trim();
          const thumbUrl = (tp || tv || '').trim() || null;

          attr.values!.push({
            id: row.value_id,
            variant_type_id: typeId,
            value: row.value_text,
            color_code: row.color_code || null,
            display_order: row.value_display_order,
            is_active: row.value_is_active === 1 || row.value_is_active === true,
            is_preselected: row.is_preselected === 1 || row.is_preselected === true,
            created_at: row.value_created_at,
            updated_at: row.value_updated_at,
            image_url: imageUrl,
            thumb_url: thumbUrl || null
          });
        }
      }

      return Array.from(byType.values());
    } catch (error) {
      console.error('Error getting product attributes:', error);
      throw error;
    }
  }

  /**
   * Add attribute to product
   */
  public async addProductAttribute(productId: number, variantTypeId: number): Promise<void> {
    try {
      await db.query(
        'INSERT IGNORE INTO product_attributes (product_id, variant_type_id) VALUES (?, ?)',
        [productId, variantTypeId]
      );
    } catch (error) {
      console.error('Error adding product attribute:', error);
      throw error;
    }
  }

  /**
   * Remove attribute from product
   */
  public async removeProductAttribute(productId: number, variantTypeId: number): Promise<void> {
    try {
      await db.query(
        'DELETE FROM product_attributes WHERE product_id = ? AND variant_type_id = ?',
        [productId, variantTypeId]
      );
    } catch (error) {
      console.error('Error removing product attribute:', error);
      throw error;
    }
  }

  /**
   * Update selected values for a product attribute
   */
  public async updateProductAttributeSelection(productId: number, variantTypeId: number, selectedValues: number[]): Promise<void> {
    try {
      await db.query(
        'UPDATE product_attributes SET selected_values = ? WHERE product_id = ? AND variant_type_id = ?',
        [JSON.stringify(selectedValues), productId, variantTypeId]
      );
    } catch (error) {
      console.error('Error updating product attribute selection:', error);
      throw error;
    }
  }

  /**
   * Get selected attribute values for a product (for variant generation)
   */
  public async getProductAttributeValues(productId: number): Promise<Map<string, string[]>> {
    try {
      const attributes = await this.getProductAttributes(productId);
      const result = new Map<string, string[]>();

      for (const attr of attributes) {
        if (attr.values && attr.values.length > 0) {
          result.set(attr.name, attr.values.map(v => v.value));
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting product attribute values:', error);
      throw error;
    }
  }
}

export default ProductAttributeService.getInstance();
