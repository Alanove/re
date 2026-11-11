const DEFAULT_API_BASE_URL = 'https://www.santamariabouar.com/api/v1';

/** Set per EAS build profile in eas.json (EXPO_PUBLIC_* values are inlined at build time). */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

/** Website root, used for images, receipts, and legal pages. */
export const SITE_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

export const LINKS = {
  privacyPolicy: `${SITE_URL}/privacy-policy`,
  terms: `${SITE_URL}/terms-and-conditions`,
  contact: `${SITE_URL}/contact`
};
