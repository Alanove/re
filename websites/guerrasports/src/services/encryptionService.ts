import * as crypto from 'crypto';
import { envConfig } from '../config/env.config';

/**
 * Encryption Service
 * 
 * Handles encryption and decryption of sensitive data using AES-256-GCM.
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  private constructor() {
    // Ensure key is 32 bytes
    const secret = envConfig.sessionSecret || 'default_secret_key_change_me_in_prod';
    // Use scrypt to generate a secure 32-byte key from the secret
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypts data object to string
   */
  public encrypt(data: any): { content: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    const textToEncrypt = JSON.stringify(data);
    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Auth tag is important for GCM mode
    const authTag = (cipher as any).getAuthTag().toString('hex');
    
    // We append the auth tag to the encrypted content
    const content = encrypted + ':' + authTag;
    
    return {
      content,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypts string to data object.
   * Returns null if decryption fails (e.g. wrong key, corrupted data, or SESSION_SECRET changed).
   * @param options.quiet - When true, suppresses the authentication-failure warning (use when caller has a fallback).
   */
  public decrypt(content: string, ivHex: string, options?: { quiet?: boolean }): any {
    if (!content || typeof content !== 'string' || !ivHex || typeof ivHex !== 'string') {
      if (!options?.quiet) console.warn('Decryption skipped: missing or invalid content/iv');
      return null;
    }
    try {
      const parts = content.split(':');
      if (parts.length < 2) {
        if (!options?.quiet) console.warn('Decryption failed: invalid encrypted content format (expected "ciphertext:authTag")');
        return null;
      }

      const textToDecrypt = parts[0];
      const authTagHex = parts[1];
      const authTag = Buffer.from(authTagHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');

      // GCM: IV 16 bytes, auth tag 16 bytes
      if (iv.length !== 16) {
        if (!options?.quiet) console.warn('Decryption failed: IV must be 16 bytes (32 hex chars), got', iv.length);
        return null;
      }
      if (authTag.length !== 16) {
        if (!options?.quiet) console.warn('Decryption failed: auth tag must be 16 bytes (32 hex chars), got', authTag.length);
        return null;
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(textToDecrypt, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('unable to authenticate') || msg.includes('Unsupported state')) {
        if (!options?.quiet) {
          console.warn(
            'Decryption failed (authentication): wrong key or corrupted data. ' +
            'If SESSION_SECRET was changed, existing encrypted addresses cannot be decrypted.'
          );
        }
      } else {
        if (!options?.quiet) console.error('Decryption failed:', error);
      }
      return null;
    }
  }
}

export const encryptionService = EncryptionService.getInstance();
export default encryptionService;
