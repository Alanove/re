"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCspDirective = parseCspDirective;
exports.getCspConfig = getCspConfig;
function parseCspDirective(envVar, defaultValue) {
    if (!envVar) {
        return defaultValue;
    }
    return envVar
        .split(',')
        .map(item => {
        const trimmed = item.trim();
        const keywords = ['none', 'self', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic', 'report-sample'];
        if (keywords.includes(trimmed)) {
            return `'${trimmed}'`;
        }
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
            return trimmed;
        }
        return trimmed;
    })
        .filter(item => item.length > 0);
}
function getDefaultCspDirective(envVar, directiveName) {
    if (!envVar) {
        throw new Error(`CSP directive ${directiveName} is not configured. Please set ${directiveName} in your .env file.`);
    }
    return parseCspDirective(envVar, []);
}
function getCspConfig(isProduction) {
    const defaultScriptSrc = getDefaultCspDirective(process.env.CSP_SCRIPT_SRC_DEFAULT, 'CSP_SCRIPT_SRC_DEFAULT');
    const defaultStyleSrc = getDefaultCspDirective(process.env.CSP_STYLE_SRC_DEFAULT, 'CSP_STYLE_SRC_DEFAULT');
    const defaultFrameSrc = getDefaultCspDirective(process.env.CSP_FRAME_SRC_DEFAULT, 'CSP_FRAME_SRC_DEFAULT');
    const defaultObjectSrc = getDefaultCspDirective(process.env.CSP_OBJECT_SRC_DEFAULT, 'CSP_OBJECT_SRC_DEFAULT');
    const defaultBaseUri = getDefaultCspDirective(process.env.CSP_BASE_URI_DEFAULT, 'CSP_BASE_URI_DEFAULT');
    const defaultImgSrc = getDefaultCspDirective(process.env.CSP_IMG_SRC_DEFAULT, 'CSP_IMG_SRC_DEFAULT');
    const defaultFontSrc = getDefaultCspDirective(process.env.CSP_FONT_SRC_DEFAULT, 'CSP_FONT_SRC_DEFAULT');
    const defaultConnectSrc = getDefaultCspDirective(process.env.CSP_CONNECT_SRC_DEFAULT, 'CSP_CONNECT_SRC_DEFAULT');
    const scriptSrc = parseCspDirective(process.env.CSP_SCRIPT_SRC, defaultScriptSrc);
    if (!scriptSrc.some((s) => s.includes('gateway.mastercard.com'))) {
        scriptSrc.push('https://*.gateway.mastercard.com');
    }
    if (!scriptSrc.some((s) => s.includes('googletagmanager.com'))) {
        scriptSrc.push('https://www.googletagmanager.com');
    }
    const frameSrc = parseCspDirective(process.env.CSP_FRAME_SRC, defaultFrameSrc);
    if (!frameSrc.some((s) => s.includes('gateway.mastercard.com'))) {
        frameSrc.push('https://*.gateway.mastercard.com');
    }
    return {
        directives: {
            scriptSrc,
            styleSrc: parseCspDirective(process.env.CSP_STYLE_SRC, defaultStyleSrc),
            frameSrc,
            objectSrc: parseCspDirective(process.env.CSP_OBJECT_SRC, defaultObjectSrc),
            baseUri: parseCspDirective(process.env.CSP_BASE_URI, defaultBaseUri),
            imgSrc: parseCspDirective(process.env.CSP_IMG_SRC, defaultImgSrc),
            fontSrc: parseCspDirective(process.env.CSP_FONT_SRC, defaultFontSrc),
            connectSrc: (() => {
                const connectSrc = parseCspDirective(process.env.CSP_CONNECT_SRC, defaultConnectSrc);
                if (!connectSrc.some((s) => s.includes('google-analytics.com'))) {
                    connectSrc.push('https://www.google-analytics.com', 'https://*.google-analytics.com');
                }
                if (!connectSrc.some((s) => s.includes('analytics.google.com'))) {
                    connectSrc.push('https://*.analytics.google.com');
                }
                if (!connectSrc.some((s) => s.includes('googletagmanager.com'))) {
                    connectSrc.push('https://www.googletagmanager.com', 'https://*.googletagmanager.com');
                }
                return connectSrc;
            })(),
            scriptSrcAttr: ["'unsafe-inline'"]
        }
    };
}
//# sourceMappingURL=cspService.js.map