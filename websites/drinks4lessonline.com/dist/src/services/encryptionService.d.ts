export declare class EncryptionService {
    private static instance;
    private algorithm;
    private key;
    private constructor();
    static getInstance(): EncryptionService;
    encrypt(data: any): {
        content: string;
        iv: string;
    };
    decrypt(content: string, ivHex: string, options?: {
        quiet?: boolean;
    }): any;
}
export declare const encryptionService: EncryptionService;
export default encryptionService;
//# sourceMappingURL=encryptionService.d.ts.map