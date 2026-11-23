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
exports.isProductFolderImageUrl = isProductFolderImageUrl;
exports.resolveProductImageUrl = resolveProductImageUrl;
exports.resolveProductThumbUrl = resolveProductThumbUrl;
exports.normalizeProductImageRow = normalizeProductImageRow;
exports.normalizeProductImages = normalizeProductImages;
exports.migratedProductImageUrls = migratedProductImageUrls;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const data_paths_1 = require("../constants/data-paths");
const imageThumbService_1 = require("./imageThumbService");
function normalizePublicUrl(url) {
    let s = url.trim().replace(/\\/g, '/');
    if (!s)
        return '';
    if (!s.startsWith('/'))
        s = '/' + s;
    return s.replace(/\/+/g, '/');
}
function isProductFolderImageUrl(productId, imageUrl) {
    const prefix = `/images/products/${productId}/`;
    return normalizePublicUrl(imageUrl).startsWith(prefix);
}
function resolveProductImageUrl(productId, storedUrl) {
    if (!storedUrl?.trim())
        return null;
    const url = normalizePublicUrl(storedUrl);
    if (isProductFolderImageUrl(productId, url))
        return url;
    const basename = path.posix.basename(url);
    if (!basename)
        return url;
    const candidate = (0, data_paths_1.getProductImagePublicUrl)(productId, basename);
    const absCandidate = (0, imageThumbService_1.publicUrlToAbsolutePath)(candidate);
    if (absCandidate && fs.existsSync(absCandidate))
        return candidate;
    const absStored = (0, imageThumbService_1.publicUrlToAbsolutePath)(url);
    if (absStored && fs.existsSync(absStored))
        return url;
    return candidate;
}
function resolveProductThumbUrl(productId, imageUrl, storedThumbUrl) {
    const resolvedImage = imageUrl ? resolveProductImageUrl(productId, imageUrl) : null;
    if (!resolvedImage) {
        if (!storedThumbUrl)
            return null;
        return resolveProductImageUrl(productId, storedThumbUrl);
    }
    return (0, imageThumbService_1.resolveListingThumbUrl)(resolvedImage, storedThumbUrl);
}
function normalizeProductImageRow(productId, row) {
    const image_url = resolveProductImageUrl(productId, row.image_url ?? null);
    const thumb_url = resolveProductThumbUrl(productId, image_url, row.thumb_url ?? null);
    return { ...row, image_url, thumb_url };
}
function normalizeProductImages(productId, rows) {
    return rows.map(row => normalizeProductImageRow(productId, row));
}
function migratedProductImageUrls(productId, sourceImageUrl) {
    const basename = path.posix.basename(normalizePublicUrl(sourceImageUrl));
    const image_url = (0, data_paths_1.getProductImagePublicUrl)(productId, basename);
    const thumb_url = (0, imageThumbService_1.thumbPublicUrlFromSourcePublicUrl)(image_url);
    return { image_url, thumb_url };
}
//# sourceMappingURL=productImageUrlService.js.map