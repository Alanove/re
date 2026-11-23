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
exports.LoggerService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class LoggerService {
    constructor() {
        this.logsDir = path.join(process.cwd(), 'logs');
        this.ensureLogsDir();
    }
    static getInstance() {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }
    ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }
    getLogFilePath() {
        const today = new Date().toISOString().split('T')[0];
        return path.join(this.logsDir, `${today}.log`);
    }
    formatMessage(level, context, message) {
        const timestamp = new Date().toISOString();
        const msgString = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${msgString}\n`;
    }
    async log(level, context, message) {
        try {
            this.ensureLogsDir();
            const logEntry = this.formatMessage(level, context, message);
            const filePath = this.getLogFilePath();
            await fs.promises.appendFile(filePath, logEntry, 'utf8');
            const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
            if (level === 'error') {
                console.error(`[${context}]`, message);
            }
            else if (debugOn) {
                console.log(`[${context}]`, message);
            }
        }
        catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }
    error(context, message) {
        return this.log('error', context, message);
    }
    info(context, message) {
        return this.log('info', context, message);
    }
    warn(context, message) {
        return this.log('warn', context, message);
    }
}
exports.LoggerService = LoggerService;
exports.default = LoggerService.getInstance();
//# sourceMappingURL=loggerService.js.map