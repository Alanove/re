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
exports.envConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getAssetVersion() {
    const fromEnv = process.env.ASSET_VERSION?.trim();
    if (fromEnv)
        return fromEnv;
    try {
        const candidates = [
            path.join(__dirname, '../../package.json'),
            path.join(__dirname, '../../../package.json'),
        ];
        for (const pkgPath of candidates) {
            if (fs.existsSync(pkgPath)) {
                const raw = fs.readFileSync(pkgPath, 'utf8');
                const pkg = JSON.parse(raw);
                if (pkg.version && String(pkg.version).trim())
                    return String(pkg.version).trim();
                break;
            }
        }
    }
    catch {
    }
    return '1';
}
const environment = (process.env.NODE_ENV || 'development').toLowerCase();
function getPort() {
    const port = process.env.PORT;
    if (environment === 'production') {
        if (!port) {
            throw new Error('PORT environment variable is required in production');
        }
        return parseInt(port, 10);
    }
    if (environment === 'testing') {
        return parseInt(port || '3004', 10);
    }
    return parseInt(port || '3003', 10);
}
function getSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (environment === 'production') {
        if (!secret) {
            throw new Error('SESSION_SECRET environment variable is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        }
        if (secret.length < 32) {
            throw new Error('SESSION_SECRET must be at least 32 characters long for production');
        }
        return secret;
    }
    if (environment === 'testing') {
        return secret || 'testing-session-secret-min-32-chars-long-for-security';
    }
    return secret || 'lw-njs-cms-admin-secret-change-in-production';
}
const useHttps = process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true';
const httpsKeyPath = process.env.HTTPS_KEY_PATH || process.env.SSL_KEY_PATH || undefined;
const httpsCertPath = process.env.HTTPS_CERT_PATH || process.env.SSL_CERT_PATH || undefined;
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || undefined;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || undefined;
exports.envConfig = {
    nodeEnv: environment,
    port: getPort(),
    sessionSecret: getSessionSecret(),
    assetVersion: getAssetVersion(),
    useHttps,
    ...(httpsKeyPath && httpsKeyPath.trim() !== '' && { httpsKeyPath }),
    ...(httpsCertPath && httpsCertPath.trim() !== '' && { httpsCertPath }),
    ...(cookieDomain && cookieDomain.trim() !== '' && { cookieDomain }),
    ...(turnstileSiteKey && { turnstileSiteKey }),
    ...(turnstileSecretKey && { turnstileSecretKey }),
    netcommerce: {
        merchantId: process.env.NETCOMMERCE_MERCHANT_ID || '',
        apiPassword: process.env.NETCOMMERCE_API_PASSWORD || '',
        gatewayUrl: process.env.NETCOMMERCE_GATEWAY_URL || 'https://test-creditlibanais-netcommerce.gateway.mastercard.com/api/rest/version/70',
        testMode: process.env.NETCOMMERCE_TEST_MODE === 'true',
        merchantName: process.env.NETCOMMERCE_MERCHANT_NAME || '',
        partnerSolutionId: process.env.NETCOMMERCE_PARTNER_SOLUTION_ID || '',
        merchantEmail: process.env.NETCOMMERCE_MERCHANT_EMAIL || '',
        merchantPhone: process.env.NETCOMMERCE_MERCHANT_PHONE || '',
        merchantLogoUrl: process.env.NETCOMMERCE_MERCHANT_LOGO_URL || '',
        merchantAddressLine1: process.env.NETCOMMERCE_MERCHANT_ADDRESS_LINE1 || '',
        merchantAddressLine2: process.env.NETCOMMERCE_MERCHANT_ADDRESS_LINE2 || ''
    }
};
exports.default = exports.envConfig;
//# sourceMappingURL=env.config.js.map