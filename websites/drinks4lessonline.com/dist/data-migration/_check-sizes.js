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
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
const { db } = require('../src/config/database');
async function check() {
    const [allColor] = await db.query(`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.color')) AS color_val
     FROM product_variants
     WHERE JSON_EXTRACT(attributes, '$.color') IS NOT NULL
     ORDER BY color_val`);
    console.log('\n=== All distinct lowercase "color" values in product_variants ===');
    console.log(JSON.stringify(allColor, null, 2));
    const [allSize] = await db.query(`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.size')) AS size_val
     FROM product_variants
     WHERE JSON_EXTRACT(attributes, '$.size') IS NOT NULL
     ORDER BY size_val`);
    console.log('\n=== All distinct lowercase "size" values in product_variants ===');
    console.log(JSON.stringify(allSize, null, 2));
    const [colorVals] = await db.query('SELECT id, value FROM variant_type_values WHERE variant_type_id = 1 ORDER BY value');
    console.log('\n=== Color canonical values (variant_type_values) ===');
    console.log(JSON.stringify(colorVals, null, 2));
    const [sizeVals] = await db.query('SELECT id, value FROM variant_type_values WHERE variant_type_id = 3 ORDER BY value');
    console.log('\n=== Size canonical values (variant_type_values) ===');
    console.log(JSON.stringify(sizeVals, null, 2));
    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=_check-sizes.js.map