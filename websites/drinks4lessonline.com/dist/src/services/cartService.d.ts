export interface CartItem {
    id?: number;
    cart_id?: number;
    product_id: number;
    variant_id?: number | null;
    quantity: number;
    price: number;
    created_at?: Date;
    updated_at?: Date;
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
export declare class CartService {
    private static instance;
    private constructor();
    static getInstance(): CartService;
    getOrCreateSessionCart(sessionId: string): Promise<ShoppingCart>;
    getOrCreateCustomerCart(customerId: number): Promise<ShoppingCart>;
    getCartById(cartId: number): Promise<ShoppingCart | null>;
    getCartItems(cartId: number): Promise<CartItem[]>;
    addItemToCart(cartId: number, productId: number, variantId: number | null, quantity: number, price: number): Promise<CartItem>;
    updateCartItemQuantity(cartItemId: number, quantity: number): Promise<void>;
    removeCartItem(cartItemId: number): Promise<void>;
    clearCart(cartId: number): Promise<void>;
    addOrderItemsToCart(cartId: number, items: Array<{
        product_id: number;
        variant_id: number | null;
        quantity: number;
        unit_price: number;
    }>): Promise<void>;
    private findCartItem;
    getCartTotals(cartId: number): Promise<{
        itemCount: number;
        subtotal: number;
        totalWeight: number;
    }>;
    mergeCarts(sessionCartId: number, customerId: number): Promise<ShoppingCart>;
    deleteOldSessionCarts(daysOld?: number): Promise<number>;
    deleteOldCustomerCarts(daysOld?: number): Promise<number>;
    setCartDiscount(cartId: number, code: string | null): Promise<void>;
}
declare const _default: CartService;
export default _default;
//# sourceMappingURL=cartService.d.ts.map