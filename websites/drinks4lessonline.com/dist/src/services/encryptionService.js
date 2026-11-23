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
exports.encryptionService = exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const env_config_1 = require("../config/env.config");
class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        const secret = env_config_1.envConfig.sessionSecret || 'default_secret_key_change_me_in_prod';
        this.key = crypto.scryptSync(secret, 'salt', 32);
    }
    static getInstance() {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService();
        }
        return EncryptionService.instance;
    }
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        const textToEncrypt = JSON.stringify(data);
        let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const content = encrypted + ':' + authTag;
        return {
            content,
            iv: iv.toString('hex')
        };
    }
    decrypt(content, ivHex, options) {
        if (!content || typeof content !== 'string' || !ivHex || typeof ivHex !== 'string') {
            if (!options?.quiet)
                console.warn('Decryption skipped: missing or invalid content/iv');
            return null;
        }
        try {
            const parts = content.split(':');
            if (parts.length < 2) {
                if (!options?.quiet)
                    console.warn('Decryption failed: invalid encrypted content format (expected "ciphertext:authTag")');
                return null;
            }
            const textToDecrypt = parts[0];
            const authTagHex = parts[1];
            const authTag = Buffer.from(authTagHex, 'hex');
            const iv = Buffer.from(ivHex, 'hex');
            if (iv.length !== 16) {
                if (!options?.quiet)
                    console.warn('Decryption failed: IV must be 16 bytes (32 hex chars), got', iv.length);
                return null;
            }
            if (authTag.length !== 16) {
                if (!options?.quiet)
                    console.warn('Decryption failed: auth tag must be 16 bytes (32 hex chars), got', authTag.length);
                return null;
            }
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(textToDecrypt, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('unable to authenticate') || msg.includes('Unsupported state')) {
                if (!options?.quiet) {
                    console.warn('Decryption failed (authentication): wrong key or corrupted data. ' +
                        'If SESSION_SECRET was changed, existing encrypted addresses cannot be decrypted.');
                }
            }
            else {
                if (!options?.quiet)
                    console.error('Decryption failed:', error);
            }
            return null;
        }
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = EncryptionService.getInstance();
exports.default = exports.encryptionService;
//# sourceMappingURL=encryptionService.js.map