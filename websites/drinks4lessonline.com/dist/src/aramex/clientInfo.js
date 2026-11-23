"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientInfo = getClientInfo;
const REQUIRED_KEYS = [
    'ARAMEX_USERNAME',
    'ARAMEX_PASSWORD',
    'ARAMEX_VERSION',
    'ARAMEX_ACCOUNT_NUMBER',
    'ARAMEX_ACCOUNT_PIN',
    'ARAMEX_ACCOUNT_ENTITY',
    'ARAMEX_ACCOUNT_COUNTRY_CODE'
];
function getClientInfo() {
    const missing = [];
    const username = process.env.ARAMEX_USERNAME?.trim();
    const password = process.env.ARAMEX_PASSWORD;
    const version = process.env.ARAMEX_VERSION?.trim();
    const accountNumber = process.env.ARAMEX_ACCOUNT_NUMBER?.trim();
    const accountPin = process.env.ARAMEX_ACCOUNT_PIN?.trim();
    const accountEntity = process.env.ARAMEX_ACCOUNT_ENTITY?.trim();
    const accountCountryCode = process.env.ARAMEX_ACCOUNT_COUNTRY_CODE?.trim();
    if (!username)
        missing.push('ARAMEX_USERNAME');
    if (password === undefined || password === null || String(password).trim() === '')
        missing.push('ARAMEX_PASSWORD');
    if (!version)
        missing.push('ARAMEX_VERSION');
    if (!accountNumber)
        missing.push('ARAMEX_ACCOUNT_NUMBER');
    if (!accountPin)
        missing.push('ARAMEX_ACCOUNT_PIN');
    if (!accountEntity)
        missing.push('ARAMEX_ACCOUNT_ENTITY');
    if (!accountCountryCode)
        missing.push('ARAMEX_ACCOUNT_COUNTRY_CODE');
    if (missing.length > 0) {
        throw new Error(`Aramex configuration missing. Set in .env: ${missing.join(', ')}`);
    }
    return {
        UserName: username,
        Password: String(password).trim(),
        Version: version,
        AccountNumber: accountNumber,
        AccountPin: accountPin,
        AccountEntity: accountEntity,
        AccountCountryCode: accountCountryCode
    };
}
//# sourceMappingURL=clientInfo.js.map