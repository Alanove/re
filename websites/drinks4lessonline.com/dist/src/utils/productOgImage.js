"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ogImageUrlFromProduct = ogImageUrlFromProduct;
exports.ogImageUrlFromProductList = ogImageUrlFromProductList;
function ogImageUrlFromProduct(product) {
    const imgs = product?.images;
    if (!imgs || imgs.length === 0)
        return '';
    const sorted = [...imgs].sort((a, b) => {
        const ap = a.is_primary === true || a.is_primary === 1 ? 1 : 0;
        const bp = b.is_primary === true || b.is_primary === 1 ? 1 : 0;
        return bp - ap;
    });
    for (const img of sorted) {
        const u = String(img.image_url || img.thumb_url || '').trim();
        if (u)
            return u;
    }
    return '';
}
function ogImageUrlFromProductList(products) {
    if (!products?.length)
        return '';
    for (const p of products) {
        const u = ogImageUrlFromProduct(p);
        if (u)
            return u;
    }
    return '';
}
//# sourceMappingURL=productOgImage.js.map