"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVariantAttributes = parseVariantAttributes;
exports.formatVariantAttributesLabel = formatVariantAttributesLabel;
exports.buildOrderVariantName = buildOrderVariantName;
function parseVariantAttributes(attributes) {
    if (!attributes)
        return null;
    if (typeof attributes === 'object')
        return attributes;
    try {
        const parsed = JSON.parse(attributes);
        return parsed && typeof parsed === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
function formatVariantAttributesLabel(attributes) {
    const attrs = parseVariantAttributes(attributes);
    if (!attrs || Object.keys(attrs).length === 0)
        return null;
    return Object.entries(attrs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');
}
function buildOrderVariantName(variant, productName) {
    const fromAttributes = formatVariantAttributesLabel(variant.attributes);
    if (fromAttributes)
        return fromAttributes;
    const variantName = variant.name?.trim();
    const product = productName.trim();
    if (variantName && variantName !== product)
        return variantName;
    return null;
}
//# sourceMappingURL=variantLabel.js.map