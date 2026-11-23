"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFacebookCatalogContentId = resolveFacebookCatalogContentId;
exports.resolveFacebookCatalogContentIdFromDb = resolveFacebookCatalogContentIdFromDb;
exports.resolveFacebookCatalogContentIdsForItems = resolveFacebookCatalogContentIdsForItems;
exports.parseMetaShopProductsParam = parseMetaShopProductsParam;
exports.resolveProductVariantFromCatalogContentId = resolveProductVariantFromCatalogContentId;
const database_1 = require("../config/database");
function resolveFacebookCatalogContentId(input) {
    const productId = input.productId;
    const variantId = input.variantId ?? null;
    const variantSku = input.variantSku?.trim() || '';
    const productSku = input.productSku?.trim() || '';
    if (variantId != null) {
        return variantSku || productSku || `P${productId}-V${variantId}`;
    }
    return productSku || `P${productId}`;
}
async function resolveFacebookCatalogContentIdFromDb(productId, variantId) {
    const [productRows] = await database_1.db.query('SELECT sku FROM products WHERE id = ? LIMIT 1', [productId]);
    const productSku = productRows[0]?.sku ?? null;
    let variantSku = null;
    if (variantId != null) {
        const [variantRows] = await database_1.db.query('SELECT sku FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1', [variantId, productId]);
        variantSku = variantRows[0]?.sku ?? null;
    }
    return resolveFacebookCatalogContentId({
        productId,
        variantId: variantId ?? null,
        productSku,
        variantSku
    });
}
async function resolveFacebookCatalogContentIdsForItems(items) {
    const ids = [];
    for (const item of items) {
        const contentId = await resolveFacebookCatalogContentIdFromDb(item.product_id, item.variant_id ?? null);
        ids.push(contentId);
    }
    return ids;
}
const META_CATALOG_ID_PATTERN = /^P(\d+)(?:-V(\d+))?$/i;
function parseMetaShopProductsParam(productsParam) {
    const quantities = new Map();
    const trimmed = productsParam.trim();
    if (!trimmed)
        return [];
    for (const entry of trimmed.split(',')) {
        const part = entry.trim();
        if (!part)
            continue;
        const colonIndex = part.indexOf(':');
        if (colonIndex <= 0 || colonIndex === part.length - 1)
            continue;
        const catalogContentId = part.slice(0, colonIndex).trim();
        const qty = parseInt(part.slice(colonIndex + 1).trim(), 10);
        if (!catalogContentId || !Number.isFinite(qty) || qty < 1)
            continue;
        quantities.set(catalogContentId, (quantities.get(catalogContentId) || 0) + qty);
    }
    return Array.from(quantities.entries()).map(([catalogContentId, quantity]) => ({
        catalogContentId,
        quantity
    }));
}
async function isPublishedActiveProduct(productId) {
    const [rows] = await database_1.db.query(`SELECT id FROM products
     WHERE id = ? AND is_active = TRUE AND status = 'published'
     LIMIT 1`, [productId]);
    return rows.length > 0;
}
async function isActiveVariantForProduct(productId, variantId) {
    const [rows] = await database_1.db.query(`SELECT id FROM product_variants
     WHERE id = ? AND product_id = ? AND is_active = TRUE
     LIMIT 1`, [variantId, productId]);
    return rows.length > 0;
}
async function resolveProductVariantFromCatalogContentId(catalogContentId) {
    const id = catalogContentId.trim();
    if (!id)
        return null;
    const patternMatch = META_CATALOG_ID_PATTERN.exec(id);
    if (patternMatch) {
        const productId = parseInt(patternMatch[1], 10);
        const variantId = patternMatch[2] ? parseInt(patternMatch[2], 10) : null;
        if (!Number.isFinite(productId))
            return null;
        if (!(await isPublishedActiveProduct(productId)))
            return null;
        if (variantId != null) {
            if (!Number.isFinite(variantId) || !(await isActiveVariantForProduct(productId, variantId))) {
                return null;
            }
            return { productId, variantId };
        }
        return { productId, variantId: null };
    }
    const [variantRows] = await database_1.db.query(`SELECT pv.id, pv.product_id
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.sku = ? AND pv.is_active = TRUE
       AND p.is_active = TRUE AND p.status = 'published'
     LIMIT 1`, [id]);
    if (variantRows.length > 0) {
        return { productId: variantRows[0].product_id, variantId: variantRows[0].id };
    }
    const [productRows] = await database_1.db.query(`SELECT id FROM products
     WHERE sku = ? AND is_active = TRUE AND status = 'published'
     LIMIT 1`, [id]);
    if (productRows.length > 0) {
        return { productId: productRows[0].id, variantId: null };
    }
    return null;
}
//# sourceMappingURL=facebookCatalogId.js.map