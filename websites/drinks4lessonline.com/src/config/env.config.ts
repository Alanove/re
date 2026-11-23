import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment Configuration
 * 
 * Centralized configuration for environment variables.
 * In production, ensure all required variables are set via environment or .env file.
 */

function getAssetVersion(): string {
  const fromEnv = process.env.ASSET_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    const candidates = [
      path.join(__dirname, '../../package.json'),
      path.join(__dirname, '../../../package.json'),
    ];
    for (const pkgPath of candidates) {
      if (fs.existsSync(pkgPath)) {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw) as { version?: string };
        if (pkg.version && String(pkg.version).trim()) return String(pkg.version).trim();
        break;
      }
    }
  } catch {
    /* ignore */
  }
  return '1';
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  sessionSecret: string;
  /** Bumped on deploy or when static assets change; used for ?v= cache busting */
  assetVersion: string;
  /** If true, start the server with HTTPS (requires HTTPS_KEY_PATH and HTTPS_CERT_PATH). */
  useHttps: boolean;
  /** Path to PEM private key file (required when useHttps is true). */
  httpsKeyPath?: string;
  /** Path to PEM certificate file (required when useHttps is true). */
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
    /** Optional: for bank Hosted Checkout Step 1 (interaction.merchant) */
    merchantEmail?: string;
    merchantPhone?: string;
    merchantLogoUrl?: string;
    merchantAddressLine1?: string;
    merchantAddressLine2?: string;
  };
}

const environment = (process.env.NODE_ENV || 'development').toLowerCase();

// Helper function to get port with validation
function getPort(): number {
  const port = process.env.PORT;
  if (environment === 'production') {
    if (!port) {
      throw new Error('PORT environment variable is required in production');
    }
    return parseInt(port, 10);
  }
  // Default ports: development=3003, testing=3004
  if (environment === 'testing') {
    return parseInt(port || '3004', 10);
  }
  return parseInt(port || '3003', 10);
}

// Helper function to get session secret with validation
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (environment === 'production') {
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long for production');
    }
    return secret;
  }
  // Default secrets for development and testing
  if (environment === 'testing') {
    return secret || 'testing-session-secret-min-32-chars-long-for-security';
  }
  return secret || 'lw-njs-cms-admin-secret-change-in-production';
}

const useHttps = process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true';
const httpsKeyPath = process.env.HTTPS_KEY_PATH || process.env.SSL_KEY_PATH || undefined;
const httpsCertPath = process.env.HTTPS_CERT_PATH || process.env.SSL_CERT_PATH || undefined;

const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

// Turnstile configuration - read from environment variables
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || undefined;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || undefined;

// Build config object from environment variables
export const envConfig: EnvConfig = {
  nodeEnv: environment,
  port: getPort(),
  sessionSecret: getSessionSecret(),
  assetVersion: getAssetVersion(),
  useHttps,
  ...(httpsKeyPath && httpsKeyPath.trim() !== '' && { httpsKeyPath }),
  ...(httpsCertPath && httpsCertPath.trim() !== '' && { httpsCertPath }),
  ...(cookieDomain && cookieDomain.trim() !== '' && { cookieDomain }),
  ...(turnstileSiteKey && { turnstileSiteKey }),
  ...(turnstileSecretKey && { turnstileSecretKey }),
  netcommerce: {
    merchantId: process.env.NETCOMMERCE_MERCHANT_ID || '',
    apiPassword: process.env.NETCOMMERCE_API_PASSWORD || '',
    gatewayUrl: process.env.NETCOMMERCE_GATEWAY_URL || 'https://test-creditlibanais-netcommerce.gateway.mastercard.com/api/rest/version/70',
    testMode: process.env.NETCOMMERCE_TEST_MODE === 'true',
    merchantName: process.env.NETCOMMERCE_MERCHANT_NAME || '',
    partnerSolutionId: process.env.NETCOMMERCE_PARTNER_SOLUTION_ID || '',
    /** Optional: for bank Hosted Checkout Step 1 payload (interaction.merchant) */
    merchantEmail: process.env.NETCOMMERCE_MERCHANT_EMAIL || '',
    merchantPhone: process.env.NETCOMMERCE_MERCHANT_PHONE || '',
    merchantLogoUrl: process.env.NETCOMMERCE_MERCHANT_LOGO_URL || '',
    merchantAddressLine1: process.env.NETCOMMERCE_MERCHANT_ADDRESS_LINE1 || '',
    merchantAddressLine2: process.env.NETCOMMERCE_MERCHANT_ADDRESS_LINE2 || ''
  }
};

export default envConfig;