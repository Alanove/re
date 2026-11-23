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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });
const database_1 = require("../config/database");
async function migrateCategoryImages() {
    console.log('Starting category image migration...');
    try {
        const [categories] = await database_1.db.query("SELECT id, image_url FROM product_categories WHERE image_url LIKE '/images/category-%'");
        console.log(`Found ${categories.length} categories to migrate.`);
        for (const cat of categories) {
            const oldPath = cat.image_url;
            const newPath = oldPath.replace('/images/', '/images/categories/');
            console.log(`Migrating ID ${cat.id}: ${oldPath} -> ${newPath}`);
            await database_1.db.query('UPDATE product_categories SET image_url = ? WHERE id = ?', [newPath, cat.id]);
        }
        console.log('Migration completed successfully.');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
migrateCategoryImages();
//# sourceMappingURL=migrate-category-images.js.map