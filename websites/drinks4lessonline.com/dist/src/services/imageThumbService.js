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
exports.publicUrlToAbsolutePath = publicUrlToAbsolutePath;
exports.thumbPublicUrlFromSourcePublicUrl = thumbPublicUrlFromSourcePublicUrl;
exports.generateThumbForPublicUrl = generateThumbForPublicUrl;
exports.deleteThumbFileForSourceImageUrl = deleteThumbFileForSourceImageUrl;
exports.deleteThumbFileByThumbUrl = deleteThumbFileByThumbUrl;
exports.resolveListingThumbUrl = resolveListingThumbUrl;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const data_paths_1 = require("../constants/data-paths");
const MAX_WIDTH = 480;
const MAX_HEIGHT = 480;
const WEBP_QUALITY = 82;
function publicUrlToAbsolutePath(publicUrl) {
    if (!publicUrl || typeof publicUrl !== 'string')
        return null;
    let u = publicUrl.trim();
    if (!u)
        return null;
    if (/^https?:\/\//i.test(u) || u.startsWith('//'))
        return null;
    u = u.replace(/\\/g, '/').replace(/^\/+/, '/');
    if (!u.startsWith('/'))
        u = '/' + u;
    return path.join(data_paths_1.DATA_PATHS.PUBLIC_DIR, u.replace(/^\//, ''));
}
function thumbPublicUrlFromSourcePublicUrl(imagePublicUrl) {
    let u = imagePublicUrl.trim().replace(/\\/g, '/');
    if (!u.startsWith('/'))
        u = '/' + u;
    const dirname = path.posix.dirname(u);
    const base = path.posix.basename(u);
    const ext = path.posix.extname(base);
    const nameWithout = ext ? base.slice(0, -ext.length) : base;
    const thumbName = `${nameWithout}.webp`;
    if (dirname === '/' || dirname === '.') {
        return `/thumbs/${thumbName}`;
    }
    return `${dirname}/thumbs/${thumbName}`;
}
function absolutePathToPublicRelative(absFilePath) {
    const norm = path.normalize(absFilePath);
    const pub = path.normalize(data_paths_1.DATA_PATHS.PUBLIC_DIR);
    if (!norm.toLowerCase().startsWith(pub.toLowerCase()))
        return null;
    return path.relative(pub, norm).replace(/\\/g, '/');
}
async function generateThumbForPublicUrl(imagePublicUrl) {
    const absSource = publicUrlToAbsolutePath(imagePublicUrl);
    if (!absSource || !fs.existsSync(absSource))
        return null;
    const rel = absolutePathToPublicRelative(absSource);
    if (!rel)
        return null;
    const lower = absSource.toLowerCase();
    if (lower.endsWith('.svg'))
        return null;
    const posixDir = path.posix.dirname(rel.replace(/\\/g, '/'));
    const baseName = path.basename(absSource, path.extname(absSource));
    const thumbDirAbs = path.join(data_paths_1.DATA_PATHS.PUBLIC_DIR, posixDir, 'thumbs');
    if (!fs.existsSync(thumbDirAbs)) {
        fs.mkdirSync(thumbDirAbs, { recursive: true });
    }
    const thumbAbs = path.join(thumbDirAbs, `${baseName}.webp`);
    try {
        await (0, sharp_1.default)(absSource)
            .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(thumbAbs);
    }
    catch (e) {
        console.error('imageThumbService: sharp failed for', absSource, e);
        return null;
    }
    return thumbPublicUrlFromSourcePublicUrl('/' + rel.replace(/\\/g, '/'));
}
function deleteThumbFileForSourceImageUrl(imagePublicUrl) {
    if (!imagePublicUrl)
        return;
    const thumbUrl = thumbPublicUrlFromSourcePublicUrl(imagePublicUrl);
    deleteThumbFileByThumbUrl(thumbUrl);
}
function deleteThumbFileByThumbUrl(thumbPublicUrl) {
    if (!thumbPublicUrl)
        return;
    const abs = publicUrlToAbsolutePath(thumbPublicUrl);
    if (abs && fs.existsSync(abs)) {
        try {
            fs.unlinkSync(abs);
        }
        catch {
        }
    }
}
function resolveListingThumbUrl(imagePublicUrl, dbThumbUrl) {
    const norm = (u) => {
        let s = u.trim().replace(/\\/g, '/');
        if (!s)
            return '';
        if (!s.startsWith('/'))
            s = '/' + s;
        return s.replace(/\/+/g, '/');
    };
    if (dbThumbUrl) {
        const u = norm(dbThumbUrl);
        if (u) {
            const abs = publicUrlToAbsolutePath(u);
            if (abs && fs.existsSync(abs))
                return u;
        }
    }
    const src = norm(imagePublicUrl || '');
    if (!src)
        return null;
    const candidate = thumbPublicUrlFromSourcePublicUrl(src);
    const absCandidate = publicUrlToAbsolutePath(candidate);
    if (absCandidate && fs.existsSync(absCandidate))
        return candidate;
    return null;
}
//# sourceMappingURL=imageThumbService.js.map