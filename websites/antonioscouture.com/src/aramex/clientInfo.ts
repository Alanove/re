/**
 * Aramex ClientInfo - built from .env only. Throws if any required value is missing.
 * No hardcoded credentials or fallbacks.
 */

const REQUIRED_KEYS = [
  'ARAMEX_USERNAME',
  'ARAMEX_PASSWORD',
  'ARAMEX_VERSION',
  'ARAMEX_ACCOUNT_NUMBER',
  'ARAMEX_ACCOUNT_PIN',
  'ARAMEX_ACCOUNT_ENTITY',
  'ARAMEX_ACCOUNT_COUNTRY_CODE'
] as const;

export interface AramexClientInfo {
  UserName: string;
  Password: string;
  Version: string;
  AccountNumber: string;
  AccountPin: string;
  AccountEntity: string;
  AccountCountryCode: string;
}

/**
 * Build ClientInfo from process.env. Throws if any required variable is missing or empty.
 */
export function getClientInfo(): AramexClientInfo {
  const missing: string[] = [];
  const username = process.env.ARAMEX_USERNAME?.trim();
  const password = process.env.ARAMEX_PASSWORD;
  const version = process.env.ARAMEX_VERSION?.trim();
  const accountNumber = process.env.ARAMEX_ACCOUNT_NUMBER?.trim();
  const accountPin = process.env.ARAMEX_ACCOUNT_PIN?.trim();
  const accountEntity = process.env.ARAMEX_ACCOUNT_ENTITY?.trim();
  const accountCountryCode = process.env.ARAMEX_ACCOUNT_COUNTRY_CODE?.trim();

  if (!username) missing.push('ARAMEX_USERNAME');
  if (password === undefined || password === null || String(password).trim() === '') missing.push('ARAMEX_PASSWORD');
  if (!version) missing.push('ARAMEX_VERSION');
  if (!accountNumber) missing.push('ARAMEX_ACCOUNT_NUMBER');
  if (!accountPin) missing.push('ARAMEX_ACCOUNT_PIN');
  if (!accountEntity) missing.push('ARAMEX_ACCOUNT_ENTITY');
  if (!accountCountryCode) missing.push('ARAMEX_ACCOUNT_COUNTRY_CODE');

  if (missing.length > 0) {
    throw new Error(`Aramex configuration missing. Set in .env: ${missing.join(', ')}`);
  }

  return {
    UserName: username!,
    Password: String(password).trim(),
    Version: version!,
    AccountNumber: accountNumber!,
    AccountPin: accountPin!,
    AccountEntity: accountEntity!,
    AccountCountryCode: accountCountryCode!
  };
}
