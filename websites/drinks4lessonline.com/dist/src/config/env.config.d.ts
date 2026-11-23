export interface EnvConfig {
    nodeEnv: string;
    port: number;
    sessionSecret: string;
    assetVersion: string;
    useHttps: boolean;
    httpsKeyPath?: string;
    httpsCertPath?: string;
    cookieDomain?: string;
    turnstileSiteKey?: string;
    turnstileSecretKey?: string;
    netcommerce: {
        merchantId: string;
        apiPassword: string;
        gatewayUrl: string;
        testMode: boolean;
        merchantName: string;
        partnerSolutionId: string;
        merchantEmail?: string;
        merchantPhone?: string;
        merchantLogoUrl?: string;
        merchantAddressLine1?: string;
        merchantAddressLine2?: string;
    };
}
export declare const envConfig: EnvConfig;
export default envConfig;
//# sourceMappingURL=env.config.d.ts.map