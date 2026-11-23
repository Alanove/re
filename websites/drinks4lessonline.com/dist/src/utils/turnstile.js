"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTurnstileSiteKey = getTurnstileSiteKey;
exports.verifyTurnstileToken = verifyTurnstileToken;
const env_config_1 = require("../config/env.config");
const TURNSTILE_DEV_SITE_KEY = '1x00000000000000000000AA';
function getTurnstileSiteKey() {
    return env_config_1.envConfig.turnstileSiteKey
        ?? (env_config_1.envConfig.nodeEnv !== 'production' ? TURNSTILE_DEV_SITE_KEY : undefined);
}
async function verifyTurnstileToken(token, remoteip) {
    if (!env_config_1.envConfig.turnstileSecretKey) {
        return true;
    }
    if (!token || typeof token !== 'string') {
        return false;
    }
    try {
        const formData = new URLSearchParams();
        formData.append('secret', env_config_1.envConfig.turnstileSecretKey);
        formData.append('response', token);
        if (remoteip)
            formData.append('remoteip', remoteip);
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        const data = await response.json();
        return data.success === true;
    }
    catch (error) {
        console.error('[Turnstile] Verify error:', error);
        return false;
    }
}
//# sourceMappingURL=turnstile.js.map