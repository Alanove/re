/**
 * Content Security Policy Service
 * 
 * Handles CSP configuration and parsing from environment variables
 * All CSP directives are configurable via environment variables
 */

/**
 * Helper function to parse CSP directives from environment variables
 * Converts comma-separated string to array, handling quoted values
 */
export function parseCspDirective(envVar: string | undefined, defaultValue: string[]): string[] {
  if (!envVar) {
    return defaultValue;
  }
  // Split by comma, trim each value, remove empty strings, and preserve quotes
  // CSP directives like 'self' and 'unsafe-inline' need quotes in the string
  return envVar
    .split(',')
    .map(item => {
      const trimmed = item.trim();
      
      // List of keywords that must be single-quoted in CSP
      const keywords = ['none', 'self', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic', 'report-sample'];
      
      // If it's a keyword and not quoted, add quotes
      if (keywords.includes(trimmed)) {
        return `'${trimmed}'`;
      }

      // If the value starts and ends with quotes, preserve them
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || 
          (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        return trimmed;
      }
      return trimmed;
    })
    .filter(item => item.length > 0);
}

/**
 * Get default CSP directive values from environment variables
 * Throws error if not configured (values should be in .env files)
 */
function getDefaultCspDirective(envVar: string | undefined, directiveName: string): string[] {
  if (!envVar) {
    throw new Error(`CSP directive ${directiveName} is not configured. Please set ${directiveName} in your .env file.`);
  }
  return parseCspDirective(envVar, []);
}

/**
 * Get CSP configuration for helmet
 * All values are configurable via environment variables:
 * - CSP_SCRIPT_SRC_DEFAULT: Default script sources (comma-separated)
 * - CSP_STYLE_SRC_DEFAULT: Default style sources (comma-separated)
 * - CSP_FRAME_SRC_DEFAULT: Default frame sources (comma-separated)
 * - CSP_OBJECT_SRC_DEFAULT: Default object sources (comma-separated)
 * - CSP_BASE_URI_DEFAULT: Default base URI sources (comma-separated)
 * - CSP_IMG_SRC_DEFAULT: Default image sources (comma-separated)
 * - CSP_FONT_SRC_DEFAULT: Default font sources (comma-separated)
 * - CSP_CONNECT_SRC_DEFAULT: Default connect sources (comma-separated)
 * 
 * You can also override specific directives:
 * - CSP_SCRIPT_SRC: Override script sources
 * - CSP_STYLE_SRC: Override style sources
 * - CSP_FRAME_SRC: Override frame sources
 * - CSP_OBJECT_SRC: Override object sources
 * - CSP_BASE_URI: Override base URI sources
 * - CSP_IMG_SRC: Override image sources
 * - CSP_FONT_SRC: Override font sources
 * - CSP_CONNECT_SRC: Override connect sources
 */
export function getCspConfig(isProduction: boolean) {
  // Get default values from environment variables (configured in .env files)
  const defaultScriptSrc = getDefaultCspDirective(
    process.env.CSP_SCRIPT_SRC_DEFAULT,
    'CSP_SCRIPT_SRC_DEFAULT'
  );

  const defaultStyleSrc = getDefaultCspDirective(
    process.env.CSP_STYLE_SRC_DEFAULT,
    'CSP_STYLE_SRC_DEFAULT'
  );

  const defaultFrameSrc = getDefaultCspDirective(
    process.env.CSP_FRAME_SRC_DEFAULT,
    'CSP_FRAME_SRC_DEFAULT'
  );

  const defaultObjectSrc = getDefaultCspDirective(
    process.env.CSP_OBJECT_SRC_DEFAULT,
    'CSP_OBJECT_SRC_DEFAULT'
  );

  const defaultBaseUri = getDefaultCspDirective(
    process.env.CSP_BASE_URI_DEFAULT,
    'CSP_BASE_URI_DEFAULT'
  );

  const defaultImgSrc = getDefaultCspDirective(
    process.env.CSP_IMG_SRC_DEFAULT,
    'CSP_IMG_SRC_DEFAULT'
  );

  const defaultFontSrc = getDefaultCspDirective(
    process.env.CSP_FONT_SRC_DEFAULT,
    'CSP_FONT_SRC_DEFAULT'
  );

  const defaultConnectSrc = getDefaultCspDirective(
    process.env.CSP_CONNECT_SRC_DEFAULT,
    'CSP_CONNECT_SRC_DEFAULT'
  );

  // Mastercard NetCommerce hosted checkout script (e.g. creditlibanais-netcommerce.gateway.mastercard.com)
  const scriptSrc = parseCspDirective(process.env.CSP_SCRIPT_SRC, defaultScriptSrc);
  if (!scriptSrc.some((s) => s.includes('gateway.mastercard.com'))) {
    scriptSrc.push('https://*.gateway.mastercard.com');
  }
  // Google Tag Manager / gtag.js (Analytics)
  if (!scriptSrc.some((s) => s.includes('googletagmanager.com'))) {
    scriptSrc.push('https://www.googletagmanager.com');
  }

  // Mastercard NetCommerce hosted checkout payment page (loads in iframe)
  const frameSrc = parseCspDirective(process.env.CSP_FRAME_SRC, defaultFrameSrc);
  if (!frameSrc.some((s) => s.includes('gateway.mastercard.com'))) {
    frameSrc.push('https://*.gateway.mastercard.com');
  }

  return {
    directives: {
      // Script sources: Allow self, CDNs, Cloudflare Turnstile, NetCommerce, and inline scripts
      scriptSrc,
      // Style sources: Allow self, CDNs, Google Fonts, and inline styles
      styleSrc: parseCspDirective(process.env.CSP_STYLE_SRC, defaultStyleSrc),
      // Frame sources: Allow self, Google Maps, YouTube, Cloudflare Turnstile, and NetCommerce
      frameSrc,
      // Object sources: Block all object/embed tags for security
      objectSrc: parseCspDirective(process.env.CSP_OBJECT_SRC, defaultObjectSrc),
      // Base URI: Prevent base tag injection attacks
      baseUri: parseCspDirective(process.env.CSP_BASE_URI, defaultBaseUri),
      // Image sources: Allow self, data URIs, and HTTPS images
      imgSrc: parseCspDirective(process.env.CSP_IMG_SRC, defaultImgSrc),
      // Font sources: Allow self, CDN fonts, and Google Fonts
      fontSrc: parseCspDirective(process.env.CSP_FONT_SRC, defaultFontSrc),
      // Connect sources: Allow API calls to self, CDNs, Cloudflare Turnstile, and Google Analytics
      connectSrc: (() => {
        const connectSrc = parseCspDirective(process.env.CSP_CONNECT_SRC, defaultConnectSrc);
        // GA4 gtag sends POST to /g/collect; allow main and regional endpoints
        if (!connectSrc.some((s) => s.includes('google-analytics.com'))) {
          connectSrc.push('https://www.google-analytics.com', 'https://*.google-analytics.com');
        }
        if (!connectSrc.some((s) => s.includes('analytics.google.com'))) {
          connectSrc.push('https://*.analytics.google.com');
        }
        if (!connectSrc.some((s) => s.includes('googletagmanager.com'))) {
          connectSrc.push('https://www.googletagmanager.com', 'https://*.googletagmanager.com');
        }
        // Socket.IO (same-origin WebSocket + polling)
        if (!connectSrc.includes("'self'")) {
          connectSrc.unshift("'self'");
        }
        if (!connectSrc.some((s) => s === 'ws:' || s === 'wss:')) {
          connectSrc.push('ws:', 'wss:');
        }
        return connectSrc;
      })(),
      // Script attributes: Allow inline event handlers
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  };
}
