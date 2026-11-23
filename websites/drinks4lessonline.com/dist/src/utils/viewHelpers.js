"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTrademarks = formatTrademarks;
exports.formatMoneyAmount = formatMoneyAmount;
exports.categoryListingImageUrl = categoryListingImageUrl;
const imageThumbService_1 = require("../services/imageThumbService");
const REG_SUP = '<sup class="tm-sup">&reg;</sup>';
function formatTrademarks(text) {
    if (typeof text !== 'string' || !text)
        return text;
    return text
        .replace(/&reg;/gi, REG_SUP)
        .replace(/&#174;/g, REG_SUP)
        .replace(/&#x00AE;/gi, REG_SUP)
        .replace(/\u00AE/g, REG_SUP)
        .replace(/®/g, REG_SUP);
}
function formatMoneyAmount(value) {
    const num = parseFloat(String(value ?? ''));
    if (!Number.isFinite(num))
        return '0';
    const s = num.toFixed(2);
    if (s.endsWith('.00'))
        return s.slice(0, -3);
    return s;
}
function categoryListingImageUrl(category) {
    const src = category?.image_url?.trim();
    if (!src)
        return '/images/no-image.jpg';
    const resolved = (0, imageThumbService_1.resolveListingThumbUrl)(src, category?.thumb_url);
    return resolved || src;
}
//# sourceMappingURL=viewHelpers.js.map