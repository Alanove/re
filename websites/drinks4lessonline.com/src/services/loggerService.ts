
import * as fs from 'fs';
import * as path from 'path';

export class LoggerService {
    private static instance: LoggerService;
    private logsDir: string;

    private constructor() {
        this.logsDir = path.join(process.cwd(), 'logs');
        this.ensureLogsDir();
    }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    private ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    private getLogFilePath(): string {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logsDir, `${today}.log`);
    }

    private formatMessage(level: string, context: string, message: any): string {
        const timestamp = new Date().toISOString();
        const msgString = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${msgString}\n`;
    }

    public async log(level: 'info' | 'error' | 'warn' | 'debug', context: string, message: any) {
        try {
            this.ensureLogsDir(); // Ensure dir exists (in case it was deleted)
            const logEntry = this.formatMessage(level, context, message);
            const filePath = this.getLogFilePath();

            // Append to file asynchronously
            await fs.promises.appendFile(filePath, logEntry, 'utf8');

            // Only log to console when DEBUG=true (set DEBUG=false to quiet terminal)
            const debugOn = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
            if (level === 'error') {
                console.error(`[${context}]`, message);
            } else if (debugOn) {
                console.log(`[${context}]`, message);
            }
        } catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }

    public error(context: string, message: any) {
        return this.log('error', context, message);
    }

    public info(context: string, message: any) {
        return this.log('info', context, message);
    }

    public warn(context: string, message: any) {
        return this.log('warn', context, message);
    }
}

export default LoggerService.getInstance();
