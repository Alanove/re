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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = migrateProductImagesToFolders;
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv_1.default.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const database_1 = require("../src/config/database");
const data_paths_1 = require("../src/constants/data-paths");
const imageThumbService_1 = require("../src/services/imageThumbService");
const productImageUrlService_1 = require("../src/services/productImageUrlService");
function copyIfMissing(srcAbs, destAbs) {
    if (!fs.existsSync(srcAbs))
        return false;
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    if (fs.existsSync(destAbs))
        return true;
    fs.copyFileSync(srcAbs, destAbs);
    return true;
}
async function migrateProductImagesToFolders() {
    console.log('\n🔄 Migrating product images to per-product folders...\n');
    const [rows] = await database_1.db.query(`SELECT id, product_id, image_url, thumb_url
     FROM product_images
     WHERE image_url IS NOT NULL AND TRIM(image_url) != ''
     ORDER BY product_id, id`);
    console.log(`Found ${rows.length} product_images row(s) to process.\n`);
    let copied = 0;
    let skipped = 0;
    let missing = 0;
    let updated = 0;
    for (const row of rows) {
        const productId = row.product_id;
        const oldImageUrl = String(row.image_url).trim();
        const prefix = `/images/products/${productId}/`;
        if (oldImageUrl.startsWith(prefix)) {
            skipped++;
            continue;
        }
        const { image_url: newImageUrl, thumb_url: expectedThumbUrl } = (0, productImageUrlService_1.migratedProductImageUrls)(productId, oldImageUrl);
        const srcAbs = (0, imageThumbService_1.publicUrlToAbsolutePath)(oldImageUrl);
        const destAbs = path.join((0, data_paths_1.getProductImagesDirPath)(productId), path.basename(newImageUrl));
        if (!srcAbs || !copyIfMissing(srcAbs, destAbs)) {
            console.warn(`  [skip] product ${productId} image ${row.id}: source missing (${oldImageUrl})`);
            missing++;
            continue;
        }
        copied++;
        let newThumbUrl = row.thumb_url ? String(row.thumb_url).trim() : null;
        const oldThumbUrl = newThumbUrl;
        if (oldThumbUrl && !oldThumbUrl.startsWith(`/images/products/${productId}/`)) {
            const thumbSrcAbs = (0, imageThumbService_1.publicUrlToAbsolutePath)(oldThumbUrl);
            const thumbDestAbs = path.join((0, data_paths_1.getProductImagesDirPath)(productId), 'thumbs', path.basename(expectedThumbUrl));
            if (thumbSrcAbs && copyIfMissing(thumbSrcAbs, thumbDestAbs)) {
                newThumbUrl = expectedThumbUrl;
            }
        }
        if (!newThumbUrl || !newThumbUrl.startsWith(`/images/products/${productId}/`)) {
            newThumbUrl = await (0, imageThumbService_1.generateThumbForPublicUrl)(newImageUrl);
        }
        await database_1.db.query('UPDATE product_images SET image_url = ?, thumb_url = ? WHERE id = ?', [newImageUrl, newThumbUrl, row.id]);
        updated++;
        console.log(`  product ${productId} #${row.id}: ${oldImageUrl} -> ${newImageUrl}`);
    }
    console.log('\n✅ Product image folder migration completed.');
    console.log(`  copied: ${copied}, db updated: ${updated}, already migrated: ${skipped}, missing source: ${missing}`);
    console.log('  Original files were not deleted.\n');
}
if (require.main === module) {
    migrateProductImagesToFolders()
        .then(() => process.exit(0))
        .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    });
}
//# sourceMappingURL=2026-07-02-migrate-product-images-to-folders.js.map