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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });
const categoryService_1 = __importDefault(require("../services/categoryService"));
async function verifyCategoryImages() {
    console.log('Verifying category images...');
    try {
        const categories = await categoryService_1.default.getAllCategories(true);
        let validCount = 0;
        let invalidCount = 0;
        for (const cat of categories) {
            if (cat.image_url) {
                if (cat.image_url.includes('/images/categories/')) {
                    validCount++;
                }
                else {
                    console.error(`Invalid path for Category ${cat.id}: ${cat.image_url}`);
                    invalidCount++;
                }
            }
        }
        console.log(`Verification complete. Valid: ${validCount}, Invalid: ${invalidCount}`);
        if (invalidCount === 0) {
            console.log('SUCCESS: All category images have correct paths.');
            process.exit(0);
        }
        else {
            console.error('FAILURE: Some category images have incorrect paths.');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}
verifyCategoryImages();
//# sourceMappingURL=verify-migration.js.map