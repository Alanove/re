import { db } from '../../src/config/database';
import { envConfig } from '../../src/config/env.config';
import encryptionService from '../../src/services/encryptionService';

/** site_settings keys with this prefix hold secrets and are excluded from SiteSettingsService. */
export const INTEGRATION_SETTING_PREFIX = 'integration.';

const TURNSTILE_KEY = `${INTEGRATION_SETTING_PREFIX}turnstile`;
const SMTP_KEY = `${INTEGRATION_SETTING_PREFIX}smtp`;

interface EncryptedValue {
  content: string;
  iv: string;
}

interface StoredTurnstile {
  enabled: boolean;
  siteKey: string;
  secret: EncryptedValue | null;
}

export type SmtpSecureMode = 'auto' | 'ssl' | 'starttls';

interface StoredSmtp {
  host: string;
  port: number;
  secure: SmtpSecureMode;
  user: string;
  password: EncryptedValue | null;
  fromEmail: string;
  fromName: string;
  rejectUnauthorized: boolean;
}

export type SettingSource = 'admin' | 'env';

export interface TurnstileConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  source: SettingSource;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  secureMode: SmtpSecureMode;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  /** Formatted "Name <email>" (or plain email) for nodemailer. */
  from: string;
  rejectUnauthorized: boolean;
  source: SettingSource;
}

export interface TurnstileAdminView {
  enabled: boolean;
  siteKey: string;
  hasSecret: boolean;
  active: boolean;
  source: SettingSource;
}

export interface SmtpAdminView {
  host: string;
  port: number;
  secureMode: SmtpSecureMode;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  rejectUnauthorized: boolean;
  configured: boolean;
  source: SettingSource;
}

export interface TurnstileInput {
  enabled: boolean;
  siteKey: string;
  /** Empty keeps the stored secret. */
  secretKey?: string;
  clearSecret?: boolean;
}

export interface SmtpInput {
  host: string;
  port: number;
  secureMode: SmtpSecureMode;
  user: string;
  /** Empty keeps the stored password. */
  password?: string;
  clearPassword?: boolean;
  fromEmail: string;
  fromName: string;
  rejectUnauthorized: boolean;
}

function encryptSecret(value: string): EncryptedValue {
  return encryptionService.encrypt(value);
}

function decryptSecret(value: EncryptedValue | null | undefined): string {
  if (!value || !value.content || !value.iv) return '';
  const decrypted = encryptionService.decrypt(value.content, value.iv);
  return typeof decrypted === 'string' ? decrypted : '';
}

function resolveSecure(mode: SmtpSecureMode, port: number): boolean {
  if (mode === 'ssl') return true;
  if (mode === 'starttls') return false;
  return port === 465;
}

function formatFrom(fromEmail: string, fromName: string): string {
  if (!fromEmail) return '';
  if (!fromName) return fromEmail;
  return `"${fromName.replace(/"/g, "'")}" <${fromEmail}>`;
}

/** Splits an env SMTP_FROM like `"Shop" <a@b.com>` into name and email. */
function parseEnvFrom(raw: string): { fromEmail: string; fromName: string } {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { fromName: (match[1] || '').trim(), fromEmail: (match[2] || '').trim() };
  return { fromName: '', fromEmail: raw.trim() };
}

export class IntegrationSettingsService {
  private static instance: IntegrationSettingsService;
  private cache: { turnstile: StoredTurnstile | null; smtp: StoredSmtp | null } | null = null;
  private cacheTime = 0;
  private readonly cacheDuration = 5000;

  private constructor() {}

  public static getInstance(): IntegrationSettingsService {
    if (!IntegrationSettingsService.instance) {
      IntegrationSettingsService.instance = new IntegrationSettingsService();
    }
    return IntegrationSettingsService.instance;
  }

  public invalidate(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  private async loadStored(): Promise<{ turnstile: StoredTurnstile | null; smtp: StoredSmtp | null }> {
    if (this.cache && Date.now() - this.cacheTime < this.cacheDuration) {
      return this.cache;
    }
    const result: { turnstile: StoredTurnstile | null; smtp: StoredSmtp | null } = {
      turnstile: null,
      smtp: null,
    };
    try {
      const [rows] = await db.query(
        'SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?)',
        [TURNSTILE_KEY, SMTP_KEY]
      );
      for (const row of rows as any[]) {
        let parsed: any = row.setting_value;
        if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            continue;
          }
        }
        if (!parsed || typeof parsed !== 'object') continue;
        if (row.setting_key === TURNSTILE_KEY) result.turnstile = parsed as StoredTurnstile;
        if (row.setting_key === SMTP_KEY) result.smtp = parsed as StoredSmtp;
      }
      this.cache = result;
      this.cacheTime = Date.now();
    } catch (error) {
      console.error('[IntegrationSettings] Failed to load settings:', error);
    }
    return result;
  }

  private async saveStored(key: string, value: object): Promise<void> {
    const json = JSON.stringify(value);
    const [result] = await db.query(
      'UPDATE site_settings SET setting_value = ?, setting_type = ? WHERE setting_key = ?',
      [json, 'object', key]
    );
    if ((result as any).affectedRows === 0) {
      await db.query(
        'INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)',
        [key, json, 'object']
      );
    }
    this.invalidate();
  }

  /**
   * Admin-saved values win; environment variables are only used until the admin saves the section.
   */
  public async getTurnstileConfig(): Promise<TurnstileConfig> {
    const { turnstile } = await this.loadStored();
    if (turnstile) {
      return {
        enabled: !!turnstile.enabled,
        siteKey: (turnstile.siteKey || '').trim(),
        secretKey: decryptSecret(turnstile.secret).trim(),
        source: 'admin',
      };
    }
    const siteKey = (envConfig.turnstileSiteKey || '').trim();
    const secretKey = (envConfig.turnstileSecretKey || '').trim();
    return { enabled: !!(siteKey && secretKey), siteKey, secretKey, source: 'env' };
  }

  /** Returns keys only when Turnstile is enabled and both keys are present. */
  public async getActiveTurnstile(): Promise<{ siteKey: string; secretKey: string } | null> {
    const cfg = await this.getTurnstileConfig();
    if (!cfg.enabled || !cfg.siteKey || !cfg.secretKey) return null;
    return { siteKey: cfg.siteKey, secretKey: cfg.secretKey };
  }

  public async getSmtpConfig(): Promise<SmtpConfig> {
    const { smtp } = await this.loadStored();
    if (smtp) {
      const port = Number(smtp.port) || 587;
      const secureMode: SmtpSecureMode = smtp.secure || 'auto';
      const fromEmail = (smtp.fromEmail || '').trim();
      const fromName = (smtp.fromName || '').trim();
      return {
        host: (smtp.host || '').trim(),
        port,
        secure: resolveSecure(secureMode, port),
        secureMode,
        user: (smtp.user || '').trim(),
        password: decryptSecret(smtp.password),
        fromEmail,
        fromName,
        from: formatFrom(fromEmail, fromName),
        rejectUnauthorized: smtp.rejectUnauthorized !== false,
        source: 'admin',
      };
    }
    const port = parseInt(process.env.SMTP_PORT || '587', 10) || 587;
    const secureMode: SmtpSecureMode =
      process.env.SMTP_SECURE === undefined ? 'auto' : process.env.SMTP_SECURE === 'true' ? 'ssl' : 'starttls';
    const envFrom = (process.env.SMTP_FROM || '').trim();
    const { fromEmail, fromName } = parseEnvFrom(envFrom);
    return {
      host: (process.env.SMTP_HOST || '').trim(),
      port,
      secure: resolveSecure(secureMode, port),
      secureMode,
      user: (process.env.SMTP_USER || '').trim(),
      password: process.env.SMTP_PASSWORD || '',
      fromEmail,
      fromName,
      from: envFrom,
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
      source: 'env',
    };
  }

  public async getTurnstileAdminView(): Promise<TurnstileAdminView> {
    const cfg = await this.getTurnstileConfig();
    return {
      enabled: cfg.enabled,
      siteKey: cfg.siteKey,
      hasSecret: !!cfg.secretKey,
      active: !!(cfg.enabled && cfg.siteKey && cfg.secretKey),
      source: cfg.source,
    };
  }

  public async getSmtpAdminView(): Promise<SmtpAdminView> {
    const cfg = await this.getSmtpConfig();
    return {
      host: cfg.host,
      port: cfg.port,
      secureMode: cfg.secureMode,
      user: cfg.user,
      hasPassword: !!cfg.password,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      rejectUnauthorized: cfg.rejectUnauthorized,
      configured: !!cfg.host,
      source: cfg.source,
    };
  }

  public async saveTurnstile(input: TurnstileInput): Promise<void> {
    const current = await this.getTurnstileConfig();
    let secret = current.secretKey;
    if (input.clearSecret) secret = '';
    if (input.secretKey && input.secretKey.trim()) secret = input.secretKey.trim();

    const stored: StoredTurnstile = {
      enabled: !!input.enabled,
      siteKey: (input.siteKey || '').trim(),
      secret: secret ? encryptSecret(secret) : null,
    };
    await this.saveStored(TURNSTILE_KEY, stored);
  }

  public async saveSmtp(input: SmtpInput): Promise<void> {
    const current = await this.getSmtpConfig();
    let password = current.password;
    if (input.clearPassword) password = '';
    if (input.password) password = input.password;

    const stored: StoredSmtp = {
      host: (input.host || '').trim(),
      port: Number(input.port) || 587,
      secure: input.secureMode,
      user: (input.user || '').trim(),
      password: password ? encryptSecret(password) : null,
      fromEmail: (input.fromEmail || '').trim(),
      fromName: (input.fromName || '').trim(),
      rejectUnauthorized: !!input.rejectUnauthorized,
    };
    await this.saveStored(SMTP_KEY, stored);
  }
}

export const integrationSettingsService = IntegrationSettingsService.getInstance();
export default integrationSettingsService;
