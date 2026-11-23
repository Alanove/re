export declare function parseCspDirective(envVar: string | undefined, defaultValue: string[]): string[];
export declare function getCspConfig(isProduction: boolean): {
    directives: {
        scriptSrc: string[];
        styleSrc: string[];
        frameSrc: string[];
        objectSrc: string[];
        baseUri: string[];
        imgSrc: string[];
        fontSrc: string[];
        connectSrc: string[];
        scriptSrcAttr: string[];
    };
};
//# sourceMappingURL=cspService.d.ts.map