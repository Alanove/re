export declare class LoggerService {
    private static instance;
    private logsDir;
    private constructor();
    static getInstance(): LoggerService;
    private ensureLogsDir;
    private getLogFilePath;
    private formatMessage;
    log(level: 'info' | 'error' | 'warn' | 'debug', context: string, message: any): Promise<void>;
    error(context: string, message: any): Promise<void>;
    info(context: string, message: any): Promise<void>;
    warn(context: string, message: any): Promise<void>;
}
declare const _default: LoggerService;
export default _default;
//# sourceMappingURL=loggerService.d.ts.map