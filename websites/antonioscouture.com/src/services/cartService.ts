import { db } from '../config/database';

export interface CartItem {
  id?: number;
  cart_id?: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
  created_at?: Date;
  updated_at?: Date;
  // Joined data
  product_name?: string;
  product_slug?: string;
  variant_name?: string;
  variant_attributes?: Record<string, string> | string | null;
  image_url?: string;
}

export interface ShoppingCart {
  id: number;
  customer_id: number | null;
  session_id: string | null;
  created_at: Date;
  updated_at: Date;
  discount_code?: string | null;
  items?: CartItem[];
}

export class CartService {
  private static instance: CartService;

  private constructor() {}

  public static getInstance(): CartService {
    if (!CartService.instance) {
      CartService.instance = new CartService();
    }
    return CartService.instance;
  }

  /**
   * Get or create cart for session
   */
  public async getOrCreateSessionCart(sessionId: string): Promise<ShoppingCart> {
    try {
      // Try to get existing cart
      const [rows] = await db.query<ShoppingCart>(
        'SELECT * FROM shopping_carts WHERE session_id = ? AND customer_id IS NULL',
        [sessionId]
      );

      if (rows.length > 0) {
        const cart = rows[0] as unknown as ShoppingCart;
        cart.items = await this.getCartItems(cart.id);
        return cart;
      }

      // Create new cart
      const [result] = await db.query<any>(
        'INSERT INTO shopping_carts (session_id) VALUES (?)',
        [sessionId]
      );

      const cartId = (result as any).insertId;
      const cart = await this.getCartById(cartId);
      if (!cart) {
        throw new Error('Failed to create cart');
      }
      cart.items = [];
      return cart;
    } catch (error) {
      console.error('Error getting or creating session cart:', error);
      throw error;
    }
  }

  /**
   * Get or create cart for customer
   */
  public async getOrCreateCustomerCart(customerId: number): Promise<ShoppingCart> {
    try {
      // Try to get existing cart
      const [rows] = await db.query<ShoppingCart>(
        'SELECT * FROM shopping_carts WHERE customer_id = ?',
        [customerId]
      );

      if (rows.length > 0) {
        const cart = rows[0] as unknown as ShoppingCart;
        cart.items = await this.getCartItems(cart.id);
        return cart;
      }

      // Create new cart
      const [result] = await db.query<any>(
        'INSERT INTO shopping_carts (customer_id) VALUES (?)',
        [customerId]
      );

      const cartId = (result as any).insertId;
      const cart = await this.getCartById(cartId);
      if (!cart) {
        throw new Error('Failed to create cart');
      }
      cart.items = [];
      return cart;
    } catch (error) {
      console.error('Error getting or creating customer cart:', error);
      throw error;
    }
  }

  /**
   * Get cart by ID
   */
  public async getCartById(cartId: number): Promise<ShoppingCart | null> {
    try {
      const [rows] = await db.query<ShoppingCart>(
        'SELECT * FROM shopping_carts WHERE id = ?',
        [cartId]
      );
      return rows.length > 0 ? (rows[0] as unknown as ShoppingCart) : null;
    } catch (error) {
      console.error('Error getting cart by ID:', error);
      throw error;
    }
  }

  /**
   * Get cart items
   */
  public async getCartItems(cartId: number): Promise<CartItem[]> {
    try {
      const [rows] = await db.query<any>(
        `SELECT 
          ci.*,
          p.name as product_name,
          p.slug as product_slug,
          pv.name as variant_name,
          pv.attributes as variant_attributes,
          (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        LEFT JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.cart_id = ?
        ORDER BY ci.created_at ASC`,
        [cartId]
      );

      // Process items to find variant-specific images
      const items = rows as unknown as CartItem[];
      const itemsWithVariants = items.filter(item => item.variant_id && (item as any).variant_attributes);

      if (itemsWithVariants.length > 0) {
        try {
          // 1. Get all variant types (attributes)
          const [variantTypes] = await db.query<any>('SELECT id, name FROM variant_types');
          const variantTypeMap = new Map<string, number>();
          variantTypes.forEach(vt => variantTypeMap.set(vt.name, vt.id));

          // 2. Collect all attribute values from items
          const valuesToFind = new Set<string>();
          itemsWithVariants.forEach((item: any) => {
             // Parse attributes if string
             let attrs = item.variant_attributes;
             if (typeof attrs === 'string') {
               try { attrs = JSON.parse(attrs); } catch (e) { attrs = {}; }
               item.variant_attributes = attrs;
             }
             
             if (attrs) {
               Object.values(attrs).forEach((val: any) => valuesToFind.add(String(val)));
             }
          });

          if (valuesToFind.size > 0) {
            // 3. Get attribute values IDs
            const [valueRows] = await db.query<any>(
              'SELECT id, value, variant_type_id FROM variant_type_values WHERE value IN (?)',
              [Array.from(valuesToFind)]
            );
            
            // Map: VariantTypeID + Value -> ValueID
            const valueIdMap = new Map<string, number>(); // Key: "TypeId:Value" -> ValueId
            valueRows.forEach(v => {
              valueIdMap.set(`${v.variant_type_id}:${v.value}`, v.id);
            });

            // 4. Get product images with attribute links for relevant products
            const productIds = itemsWithVariants.map(i => i.product_id);
            if (productIds.length > 0) {
               const [imageRows] = await db.query<any>(
                 'SELECT product_id, attribute_value_id, image_url FROM product_images WHERE product_id IN (?) AND attribute_value_id IS NOT NULL',
                 [productIds]
               );

               // Map: ProductID + AttributeValueID -> ImageURL
               const imageMap = new Map<string, string>(); // Key: "ProducId:ValueId" -> URL
               imageRows.forEach(img => {
                 imageMap.set(`${img.product_id}:${img.attribute_value_id}`, img.image_url);
               });

               // 5. Assign images to items
               itemsWithVariants.forEach((item: any) => {
                 if (item.variant_attributes) {
                   for (const [attrName, attrValue] of Object.entries(item.variant_attributes)) {
                     const typeId = variantTypeMap.get(attrName);
                     if (typeId) {
                       const valueId = valueIdMap.get(`${typeId}:${attrValue}`);
                       if (valueId) {
                         const specificImage = imageMap.get(`${item.product_id}:${valueId}`);
                         if (specificImage) {
                           item.image_url = specificImage; // Override primary image
                           break; // prioritized one image?
                         }
                       }
                     }
                   }
                 }
               });
            }
          }
        } catch (err) {
          console.error('Error resolving variant images:', err);
          // Continue with default images
        }
      }

      return items;
    } catch (error) {
      console.error('Error getting cart items:', error);
      throw error;
    }
  }

  /**
   * Add item to cart
   */
  public async addItemToCart(
    cartId: number,
    productId: number,
    variantId: number | null,
    quantity: number,
    price: number
  ): Promise<CartItem> {
    try {
      // Check if item already exists
      const existingItem = await this.findCartItem(cartId, productId, variantId);

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + quantity;
        await db.query(
          'UPDATE cart_items SET quantity = ?, price = ?, updated_at = NOW() WHERE id = ?',
          [newQuantity, price, existingItem.id]
        );
        return { ...existingItem, quantity: newQuantity, price } as CartItem;
      } else {
        // Add new item
        const [result] = await db.query<any>(
          'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [cartId, productId, variantId, quantity, price]
        );

        const itemId = (result as any).insertId;
        const [rows] = await db.query<CartItem>(
          'SELECT * FROM cart_items WHERE id = ?',
          [itemId]
        );

        if (rows.length === 0) {
          throw new Error('Failed to create cart item');
        }

        return rows[0] as unknown as CartItem;
      }
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  }

  /**
   * Update cart item quantity
   */
  public async updateCartItemQuantity(cartItemId: number, quantity: number): Promise<void> {
    try {
      if (quantity <= 0) {
        await this.removeCartItem(cartItemId);
        return;
      }

      await db.query(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?',
        [quantity, cartItemId]
      );
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  public async removeCartItem(cartItemId: number): Promise<void> {
    try {
      await db.query('DELETE FROM cart_items WHERE id = ?', [cartItemId]);
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  public async clearCart(cartId: number): Promise<void> {
    try {
      await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  /**
   * Restore order items into a cart (e.g. after payment cancelled). Merges quantities if same product/variant already in cart.
   */
  public async addOrderItemsToCart(
    cartId: number,
    items: Array<{ product_id: number; variant_id: number | null; quantity: number; unit_price: number }>
  ): Promise<void> {
    for (const item of items) {
      await this.addItemToCart(
        cartId,
        item.product_id,
        item.variant_id,
        item.quantity,
        item.unit_price
      );
    }
  }

  /**
   * Find existing cart item
   */
  private async findCartItem(
    cartId: number,
    productId: number,
    variantId: number | null
  ): Promise<CartItem | null> {
    try {
        const [rows] = await db.query<CartItem>(
          'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))',
          [cartId, productId, variantId, variantId]
        );
        return rows.length > 0 ? (rows[0] as unknown as CartItem) : null;
    } catch (error) {
      console.error('Error finding cart item:', error);
      return null;
    }
  }

  /**
   * Get cart totals
   */
  public async getCartTotals(cartId: number): Promise<{
    itemCount: number;
    subtotal: number;
    totalWeight: number;
  }> {
    try {
      const [rows] = await db.query<any>(
        `SELECT 
          ci.quantity,
          ci.price,
          p.weight as product_weight,
          pv.weight as variant_weight
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        LEFT JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.cart_id = ?`,
        [cartId]
      );

      let itemCount = 0;
      let subtotal = 0;
      let totalWeight = 0;

      rows.forEach((row: any) => {
        const qty = parseInt(row.quantity || '0');
        const price = parseFloat(row.price || '0');
        const weight = parseFloat(row.variant_weight || row.product_weight || '0.5'); // Default to 0.5kg if not set

        itemCount += qty;
        subtotal += qty * price;
        totalWeight += qty * weight;
      });

      return {
        itemCount,
        subtotal,
        totalWeight
      };
    } catch (error) {
      console.error('Error getting cart totals:', error);
      return { itemCount: 0, subtotal: 0, totalWeight: 0 };
    }
  }

  /**
   * Merge session cart into customer cart
   */
  public async mergeCarts(sessionCartId: number, customerId: number): Promise<ShoppingCart> {
    try {
      const customerCart = await this.getOrCreateCustomerCart(customerId);
      const sessionItems = await this.getCartItems(sessionCartId);

      // Add all session items to customer cart
      for (const item of sessionItems) {
        await this.addItemToCart(
          customerCart.id,
          item.product_id,
          item.variant_id || null,
          item.quantity,
          item.price
        );
      }

      // Delete session cart
      await db.query('DELETE FROM shopping_carts WHERE id = ?', [sessionCartId]);

      // Return updated customer cart
      customerCart.items = await this.getCartItems(customerCart.id);
      return customerCart;
    } catch (error) {
      console.error('Error merging carts:', error);
      throw error;
    }
  }

  /**
   * Delete old session (guest) carts (cleanup). cart_items removed by CASCADE.
   */
  public async deleteOldSessionCarts(daysOld: number = 30): Promise<number> {
    const BATCH_SIZE = 500;
    let total = 0;
    try {
      let affected: number;
      do {
        const [result] = await db.query<any>(
          `DELETE FROM shopping_carts 
          WHERE customer_id IS NULL 
          AND session_id IS NOT NULL 
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          LIMIT ?`,
          [daysOld, BATCH_SIZE]
        );
        affected = (result as any).affectedRows || 0;
        total += affected;
        if (affected > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (affected === BATCH_SIZE);
      return total;
    } catch (error) {
      console.error('Error deleting old session carts:', error);
      return total;
    }
  }

  /**
   * Delete old customer carts (cleanup). cart_items removed by CASCADE.
   */
  public async deleteOldCustomerCarts(daysOld: number = 365): Promise<number> {
    const BATCH_SIZE = 500;
    let total = 0;
    try {
      let affected: number;
      do {
        const [result] = await db.query<any>(
          `DELETE FROM shopping_carts 
          WHERE customer_id IS NOT NULL 
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          LIMIT ?`,
          [daysOld, BATCH_SIZE]
        );
        affected = (result as any).affectedRows || 0;
        total += affected;
        if (affected > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (affected === BATCH_SIZE);
      return total;
    } catch (error) {
      console.error('Error deleting old customer carts:', error);
      return total;
    }
  }

  /**
   * Set discount code for cart
   */
  public async setCartDiscount(cartId: number, code: string | null): Promise<void> {
    try {
      await db.query(
        'UPDATE shopping_carts SET discount_code = ?, updated_at = NOW() WHERE id = ?',
        [code, cartId]
      );
    } catch (error) {
      console.error('Error setting cart discount:', error);
      throw error;
    }
  }
}

export default CartService.getInstance();

