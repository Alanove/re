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
require("./config/setup-env");
if (typeof globalThis.File === 'undefined') {
    globalThis.File = class File {
        constructor(bits = [], name = '', options = {}) {
            this.name = name;
            this.lastModified = options.lastModified || Date.now();
            this.size = 0;
            this.type = options.type || '';
            this.webkitRelativePath = options.webkitRelativePath || '';
        }
        slice(start, end, contentType) {
            return new Blob();
        }
        stream() {
            return {
                getReader: () => ({ read: () => Promise.resolve({ done: true, value: undefined }) })
            };
        }
        text() {
            return Promise.resolve('');
        }
        arrayBuffer() {
            return Promise.resolve(new ArrayBuffer(0));
        }
    };
    if (typeof globalThis.Blob === 'undefined') {
        globalThis.Blob = class Blob {
            constructor(bits = [], options = {}) {
                this.bits = bits;
                this.options = options;
                this.size = 0;
                this.type = '';
            }
            slice(start, end, contentType) {
                return new Blob();
            }
        };
    }
}
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const express_1 = __importDefault(require("express"));
const express_ejs_layouts_1 = __importDefault(require("express-ejs-layouts"));
const pagesService_1 = __importDefault(require("./services/pagesService"));
const paymentService_1 = __importDefault(require("./services/paymentService"));
const securityService_1 = __importDefault(require("./services/securityService"));
const middlewareService_1 = __importDefault(require("./services/middlewareService"));
const currentUrlProviderService_1 = require("./services/currentUrlProviderService");
const index_1 = require("./routes/index");
const env_config_1 = require("./config/env.config");
const cleanupService_1 = __importDefault(require("./services/cleanupService"));
const app = (0, express_1.default)();
app.set('trust proxy', 2);
const canonicalRedirectUrl = process.env.APP_URL?.trim();
if (canonicalRedirectUrl) {
    console.log(`Canonical URL redirect: enabled → ${canonicalRedirectUrl.replace(/\/$/, '')}`);
}
else {
    console.log('Canonical URL redirect: disabled (APP_URL not set). NODE_ENV=%s — ensure .env.production exists in project root and you start with npm run start:prod', process.env.NODE_ENV || '(not set)');
}
app.use(currentUrlProviderService_1.redirectToCanonicalUrlMiddleware);
const getProjectRoot = () => {
    if (__dirname.includes('dist')) {
        return path.resolve(__dirname, '../../');
    }
    return path.resolve(__dirname, '../');
};
const projectRoot = getProjectRoot();
app.set('view engine', 'ejs');
app.set('views', [
    path.join(projectRoot, 'views'),
    path.join(projectRoot, 'admin/views')
]);
const STATIC_CACHE_MS = 365 * 24 * 60 * 60 * 1000;
const UPLOADS_CACHE_SEC = 7 * 24 * 60 * 60;
const STATIC_VIDEO_EXT_TO_TYPE = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/x-m4v',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
};
function setPublicStaticHeaders(res, filePath) {
    const norm = filePath.replace(/\\/g, '/');
    if (norm.includes('/uploads/')) {
        res.setHeader('Cache-Control', `public, max-age=${UPLOADS_CACHE_SEC}`);
    }
    else {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
    const ext = path.extname(filePath).toLowerCase();
    const videoType = STATIC_VIDEO_EXT_TO_TYPE[ext];
    if (videoType) {
        res.setHeader('Content-Type', videoType);
        res.setHeader('Content-Disposition', 'inline');
    }
}
app.use(express_1.default.static(path.join(projectRoot, 'public'), {
    maxAge: STATIC_CACHE_MS,
    setHeaders: setPublicStaticHeaders,
}));
app.use('/admin', express_1.default.static(path.join(projectRoot, 'admin/public'), {
    maxAge: STATIC_CACHE_MS,
    setHeaders(res, filePath) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        const ext = path.extname(filePath).toLowerCase();
        const videoType = STATIC_VIDEO_EXT_TO_TYPE[ext];
        if (videoType) {
            res.setHeader('Content-Type', videoType);
            res.setHeader('Content-Disposition', 'inline');
        }
    },
}));
app.use(express_ejs_layouts_1.default);
app.set('layout', 'layout');
securityService_1.default.configureHelmet(app);
securityService_1.default.configureSession(app);
securityService_1.default.configureCookieSecureMiddleware(app);
securityService_1.default.configureSessionDebugMiddleware(app);
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
securityService_1.default.configureCsrfProtection(app);
securityService_1.default.configureCsrfTokenInJsonResponse(app);
securityService_1.default.configureCsrfErrorHandler(app);
middlewareService_1.default.configureGeneralMiddleware(app);
(0, index_1.configureRoutes)(app);
(0, index_1.configure404Handler)(app);
const PORT = env_config_1.envConfig.port;
async function startServer() {
    try {
        await pagesService_1.default.initialize();
        console.log('✅ Database and cache initialized');
        try {
            await paymentService_1.default.initializeDefaultPaymentMethods();
            console.log('✅ Payment methods initialized');
        }
        catch (error) {
            console.warn('⚠️  Warning: Could not initialize payment methods:', error);
        }
        cleanupService_1.default.start();
        if (env_config_1.envConfig.useHttps && !(env_config_1.envConfig.httpsKeyPath && env_config_1.envConfig.httpsCertPath)) {
            console.warn('⚠️  USE_HTTPS is set but HTTPS_KEY_PATH and HTTPS_CERT_PATH are required. Starting HTTP server.');
        }
        if (env_config_1.envConfig.useHttps && env_config_1.envConfig.httpsKeyPath && env_config_1.envConfig.httpsCertPath) {
            const keyPath = path.isAbsolute(env_config_1.envConfig.httpsKeyPath)
                ? env_config_1.envConfig.httpsKeyPath
                : path.join(projectRoot, env_config_1.envConfig.httpsKeyPath);
            const certPath = path.isAbsolute(env_config_1.envConfig.httpsCertPath)
                ? env_config_1.envConfig.httpsCertPath
                : path.join(projectRoot, env_config_1.envConfig.httpsCertPath);
            const httpsOptions = {
                key: fs.readFileSync(keyPath, 'utf8'),
                cert: fs.readFileSync(certPath, 'utf8'),
            };
            https.createServer(httpsOptions, app).listen(PORT, () => {
                console.log(`✅ HTTPS server running on https://localhost:${PORT}`);
            });
        }
        else {
            app.listen(PORT, () => {
                console.log(`✅ Server running on port ${PORT}`);
                if (process.env.BRAINS_SYNC_ENABLED === 'true') {
                    const dayMs = 24 * 60 * 60 * 1000;
                    setInterval(() => {
                        Promise.resolve().then(() => __importStar(require('./services/brainsSyncService'))).then((mod) => mod.syncBrainsStock())
                            .catch((error) => console.error('Brains sync failed', error));
                    }, dayMs);
                }
            });
        }
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=app.js.map