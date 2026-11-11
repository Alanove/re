/**
 * SafeMate cloud client for main-gate app users.
 * Never call user_login.php — that rebinds the open-operator phone.
 * Every public method returns a result and does not throw.
 */
import { db } from '../config/database';
import { GATE_OPERATOR } from '../config/gateOperator';

const SECURITY_CODE = 'SDLKELS384DJ29Z49021DX30D92KS58S';
const PHONE_CODE = '961';
const REQUEST_TIMEOUT_MS = 8000;
const MAC_SLOTS = 20;
/** SafeMate app password. Sent exactly as written. Do not hash or alter it. */
export const SAFEMATE_APP_PASSWORD = '12345678';
const SAFEMATE_EMAIL_DOMAIN = 'gate.santamariabouar.com';

export interface SafegateResult {
  ok: boolean;
  skipped?: boolean;
  /** SafeMate account was already present. Callers may treat that as success. */
  alreadyExisted?: boolean;
  message?: string;
  account?: string;
}

export interface SafemateSubUser {
  account: string;
  phone: string;
  email: string;
  validDate: string;
  masterAccount: string;
  protected: boolean;
}

export interface SafegateUserRef {
  id: number;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}

interface CloudResponse {
  result?: number | string;
  errno?: number | string;
  message?: unknown;
}

class SafegateCloudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafegateCloudError';
  }
}

/** Digits only, then the last 6. Shorter values do not match. */
export function phoneKey(value: string | null | undefined): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 6) {
    return '';
  }
  return digits.slice(-6);
}

/** Last-6 keys for every number in a value. `:::` separates multiple phones. */
export function phoneKeys(value: string | null | undefined): string[] {
  const keys = new Set<string>();
  for (const part of String(value || '').split(':::')) {
    const key = phoneKey(part);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}

function protectedAccounts(): Set<string> {
  return new Set(
    [GATE_OPERATOR.account, GATE_OPERATOR.master_account]
      .map((account) => String(account || '').trim())
      .filter(Boolean)
  );
}

export function isProtectedSafemateAccount(account: string | null | undefined): boolean {
  const value = String(account || '').trim();
  return value.length > 0 && protectedAccounts().has(value);
}

function gateMac(): string {
  return String(GATE_OPERATOR.devices[0]?.mac || '').trim();
}

function macKey(mac: string): string {
  return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
}

function asObjectList(message: unknown): Record<string, unknown>[] {
  if (Array.isArray(message)) {
    return message.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  }
  if (message && typeof message === 'object') {
    return [message as Record<string, unknown>];
  }
  return [];
}

function cloudFailed(data: CloudResponse): boolean {
  return Number(data.result) !== 0;
}

function errnoOf(data: CloudResponse): number {
  const errno = Number(data.errno);
  return Number.isFinite(errno) ? errno : -1;
}

/** Name local-part: lowercase, spaces become dots, other characters are removed. */
export function safemateEmailLocalFromName(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]+/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Real email when one was given. Otherwise name@gate.santamariabouar.com,
 * or the SafeMate phone account when the name cannot make a local part.
 */
export function safemateCloudEmail(input: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  account?: string | null;
}): string {
  const real = String(input.email || '').trim();
  if (real) {
    return real;
  }
  const fromName = safemateEmailLocalFromName(input.name);
  const account = String(input.account || '').trim() || safemateAccountFromPhone(input.phone) || '';
  const local = fromName || account;
  if (!local) {
    return '';
  }
  return `${local}@${SAFEMATE_EMAIL_DOMAIN}`;
}

/** Local SafeMate account: digits, drop 961 and one leading 0 when 8 digits remain. */
export function safemateAccountFromPhone(phone: string | null | undefined): string | null {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('961') && digits.length - 3 >= 8) {
    digits = digits.slice(3);
  }
  if (digits.startsWith('0') && digits.length - 1 >= 8) {
    digits = digits.slice(1);
  }
  if (digits.length < 8 || !/^\d+$/.test(digits)) {
    return null;
  }
  return digits;
}

function toValidDate(expiryDate?: string | null): string | undefined {
  const trimmed = String(expiryDate || '').trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} 23:59:59`;
  }
  return trimmed;
}

function cloudFailureText(error: unknown, keptDatabase: boolean): string {
  if (error instanceof SafegateCloudError) {
    return error.message;
  }
  const aborted = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
  if (aborted) {
    return keptDatabase
      ? 'SafeMate did not respond in time. The database change was kept.'
      : 'SafeMate did not respond in time.';
  }
  return keptDatabase
    ? 'SafeMate is unreachable. The database change was kept.'
    : 'SafeMate is unreachable.';
}

function unreachableMessage(error: unknown): string {
  return cloudFailureText(error, true);
}

function directFailureMessage(error: unknown): string {
  return cloudFailureText(error, false);
}

function withoutDatabaseNote(message?: string): string {
  return String(message || '').replace(/\s*The database change was kept\.?/g, '').trim();
}

async function postPhp(script: string, fields: Record<string, string>): Promise<CloudResponse> {
  const body = new URLSearchParams({ security_code: SECURITY_CODE, ...fields });
  const domain = GATE_OPERATOR.domain;
  let response: Response;
  try {
    response = await fetch(`http://${domain}/yetcloud_release/${script}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'User-Agent': 'Safemate/2.4.9'
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    console.error(`SafeMate ${script} request failed:`, error);
    throw error;
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as CloudResponse;
  } catch (error) {
    console.error(`SafeMate ${script} returned non-JSON (${response.status}):`, text.slice(0, 200));
    throw error;
  }
}

function mapSubUser(row: Record<string, unknown>): SafemateSubUser {
  const account = String(row.account || '').trim();
  return {
    account,
    phone: String(row.phone || '').trim(),
    email: String(row.email || '').trim(),
    validDate: String(row.valid_date || row.validDate || '').trim(),
    masterAccount: String(row.master_account || row.masterAccount || '').trim(),
    protected: isProtectedSafemateAccount(account)
  };
}

function userMatchesPhone(user: SafemateSubUser, phone: string): boolean {
  const key = phoneKey(phone);
  if (!key) {
    return false;
  }
  return phoneKey(user.phone) === key || phoneKey(user.account) === key;
}

class SafegateService {
  private async fetchSubUsers(): Promise<SafemateSubUser[]> {
    const data = await postPhp('get_subsite_account_data.php', {
      master_account: GATE_OPERATOR.master_account
    });
    if (errnoOf(data) === 21) {
      return [];
    }
    if (cloudFailed(data)) {
      throw new SafegateCloudError(`SafeMate could not list app users (errno ${errnoOf(data)}).`);
    }
    return asObjectList(data.message).map(mapSubUser).filter((user) => user.account);
  }

  async listSubUsers(): Promise<{ ok: boolean; users: SafemateSubUser[]; message?: string }> {
    try {
      const users = await this.fetchSubUsers();
      return { ok: true, users };
    } catch (error) {
      console.error('SafeMate listSubUsers failed:', error);
      return { ok: false, users: [], message: unreachableMessage(error) };
    }
  }

  async isAvailable(): Promise<boolean> {
    const listed = await this.listSubUsers();
    return listed.ok;
  }

  private async ensureGateMac(account: string): Promise<SafegateResult> {
    if (isProtectedSafemateAccount(account)) {
      return {
        ok: false,
        skipped: true,
        message: `SafeMate account ${account} is protected and was not changed.`
      };
    }

    const assignedMac = gateMac();
    if (!assignedMac) {
      return { ok: false, skipped: true, message: 'No main gate device is configured.' };
    }

    const current = await postPhp('get_subordinate_device.php', { account });
    const macs: string[] = Array.from({ length: MAC_SLOTS }, () => '');
    if (!cloudFailed(current)) {
      const row = asObjectList(current.message)[0] || {};
      for (let i = 1; i <= MAC_SLOTS; i++) {
        macs[i - 1] = String(row[`mac${i}`] || '');
      }
    }

    const wanted = macKey(assignedMac);
    if (wanted && macs.some((mac) => macKey(mac) === wanted)) {
      return {
        ok: true,
        skipped: true,
        account,
        message: `SafeMate account ${account} already has the main gate.`
      };
    }

    const emptyIndex = macs.findIndex((mac) => !String(mac).trim());
    if (!cloudFailed(current) && emptyIndex === -1) {
      return {
        ok: false,
        skipped: true,
        account,
        message: `SafeMate account ${account} has no free device slot for the main gate. The database change was kept.`
      };
    }

    if (cloudFailed(current)) {
      macs.fill('');
      macs[0] = assignedMac;
    } else {
      macs[emptyIndex] = assignedMac;
    }

    const fields: Record<string, string> = { account };
    macs.forEach((mac, index) => {
      fields[`mac${index + 1}`] = mac;
    });
    const updated = await postPhp('update_subordinate_device.php', fields);
    if (cloudFailed(updated)) {
      return {
        ok: false,
        account,
        message: `SafeMate could not assign the main gate (errno ${errnoOf(updated)}). The database change was kept.`
      };
    }
    return {
      ok: true,
      account,
      message: `SafeMate account ${account} can open the main gate.`
    };
  }

  async grantAccess(input: {
    phone?: string | null;
    email?: string | null;
    name?: string | null;
    expiryDate?: string | null;
    existingAccount?: string | null;
  }): Promise<SafegateResult> {
    try {
      const phone = String(input.phone || '').trim();
      const existingAccount = String(input.existingAccount || '').trim();
      const users = await this.fetchSubUsers();

      let targetAccount = '';
      if (existingAccount) {
        if (isProtectedSafemateAccount(existingAccount)) {
          return {
            ok: false,
            skipped: true,
            message: `SafeMate account ${existingAccount} is protected and was not changed.`
          };
        }
        targetAccount = existingAccount;
      } else {
        const matches = users.filter((user) => userMatchesPhone(user, phone));
        if (matches.length > 1) {
          return {
            ok: false,
            skipped: true,
            message: 'Several SafeMate accounts match this phone, so none was changed. The database change was kept.'
          };
        }
        if (matches.length === 1) {
          if (matches[0].protected) {
            return {
              ok: false,
              skipped: true,
              message: `SafeMate account ${matches[0].account} is protected and was not changed.`
            };
          }
          targetAccount = matches[0].account;
        }
      }

      if (targetAccount) {
        const assigned = await this.ensureGateMac(targetAccount);
        return { ...assigned, alreadyExisted: true };
      }

      const account = safemateAccountFromPhone(phone);
      if (!account) {
        return {
          ok: false,
          skipped: true,
          message: 'This phone cannot be used as a SafeMate account. The database change was kept.'
        };
      }
      if (isProtectedSafemateAccount(account)) {
        return {
          ok: false,
          skipped: true,
          message: `SafeMate account ${account} is protected and was not changed.`
        };
      }

      const password = SAFEMATE_APP_PASSWORD;
      const email = safemateCloudEmail({
        email: input.email,
        name: input.name,
        phone,
        account
      });
      const fields: Record<string, string> = {
        account,
        password,
        country_code: GATE_OPERATOR.country_code || 'LB',
        phone_code: PHONE_CODE,
        phone: account,
        email,
        master_account: GATE_OPERATOR.master_account
      };
      const validDate = toValidDate(input.expiryDate);
      if (validDate) {
        fields.valid_date = validDate;
      }

      const created = await postPhp('add_subsite_account.php', fields);
      const alreadyExists = errnoOf(created) === 16;
      if (cloudFailed(created) && !alreadyExists) {
        return {
          ok: false,
          account,
          message: `SafeMate could not create account ${account} (errno ${errnoOf(created)}). The database change was kept.`
        };
      }

      const assigned = await this.ensureGateMac(account);
      if (alreadyExists) {
        return { ...assigned, alreadyExisted: true };
      }
      const passwordNote = `SafeMate account ${account} was created. App password: ${SAFEMATE_APP_PASSWORD}.`;
      if (!assigned.ok) {
        return {
          ok: false,
          account,
          message: `${passwordNote} ${assigned.message || ''}`.trim()
        };
      }
      return { ok: true, account, message: `${passwordNote} ${assigned.message || ''}`.trim() };
    } catch (error) {
      console.error('SafeMate grantAccess failed:', error);
      return { ok: false, message: unreachableMessage(error) };
    }
  }

  /**
   * Create a SafeMate account only. Does not read or write CMS tables.
   * Password is always SAFEMATE_APP_PASSWORD.
   */
  async createDirectAccount(input: {
    account?: string | null;
    name?: string | null;
    email?: string | null;
    validDate?: string | null;
  }): Promise<SafegateResult> {
    try {
      const raw = String(input.account || '').trim();
      const account = safemateAccountFromPhone(raw);
      if (!account) {
        return { ok: false, message: 'This phone cannot be used as a SafeMate account.' };
      }
      if (isProtectedSafemateAccount(account)) {
        return {
          ok: false,
          skipped: true,
          message: `SafeMate account ${account} is protected and was not changed.`
        };
      }

      const email = safemateCloudEmail({
        email: input.email,
        name: input.name,
        phone: raw,
        account
      });
      if (!email) {
        return { ok: false, message: 'An email or a name is required.' };
      }

      const fields: Record<string, string> = {
        account,
        password: SAFEMATE_APP_PASSWORD,
        country_code: GATE_OPERATOR.country_code || 'LB',
        phone_code: PHONE_CODE,
        phone: account,
        email,
        master_account: GATE_OPERATOR.master_account
      };
      const validDate = toValidDate(input.validDate);
      if (validDate) {
        fields.valid_date = validDate;
      }

      const created = await postPhp('add_subsite_account.php', fields);
      const alreadyExists = errnoOf(created) === 16;
      if (cloudFailed(created) && !alreadyExists) {
        return {
          ok: false,
          account,
          message: `SafeMate could not create account ${account} (errno ${errnoOf(created)}).`
        };
      }

      const assigned = await this.ensureGateMac(account);
      const gateNote = withoutDatabaseNote(assigned.message);
      if (alreadyExists) {
        const message = `SafeMate account ${account} already exists. Use Edit to set the app password back to ${SAFEMATE_APP_PASSWORD}.`;
        return {
          ok: assigned.ok,
          account,
          message: `${message} ${gateNote}`.trim()
        };
      }
      const createdNote = `SafeMate account ${account} was created. App password: ${SAFEMATE_APP_PASSWORD}. Email: ${email}.`;
      return {
        ok: assigned.ok,
        account,
        message: `${createdNote} ${gateNote}`.trim()
      };
    } catch (error) {
      console.error('SafeMate createDirectAccount failed:', error);
      return { ok: false, message: directFailureMessage(error) };
    }
  }

  /**
   * Update a SafeMate account only. Saving always writes SAFEMATE_APP_PASSWORD.
   * Does not read or write CMS tables.
   */
  async updateDirectAccount(input: {
    account?: string | null;
    name?: string | null;
    email?: string | null;
    validDate?: string | null;
  }): Promise<SafegateResult> {
    try {
      const account = String(input.account || '').trim();
      if (!account) {
        return { ok: false, message: 'Missing SafeMate account.' };
      }
      if (isProtectedSafemateAccount(account)) {
        return {
          ok: false,
          skipped: true,
          message: `SafeMate account ${account} is protected and was not changed.`
        };
      }

      const email = safemateCloudEmail({
        email: input.email,
        name: input.name,
        phone: account,
        account
      });
      if (!email) {
        return { ok: false, message: 'An email or a name is required.' };
      }

      const fields: Record<string, string> = {
        account,
        password: SAFEMATE_APP_PASSWORD,
        email
      };
      const validDate = toValidDate(input.validDate);
      if (validDate) {
        fields.valid_date = validDate;
      }

      const updated = await postPhp('update_user_data.php', fields);
      if (cloudFailed(updated)) {
        return {
          ok: false,
          account,
          message: `SafeMate could not update account ${account} (errno ${errnoOf(updated)}).`
        };
      }
      return {
        ok: true,
        account,
        message: `SafeMate account ${account} was updated. App password: ${SAFEMATE_APP_PASSWORD}. Email: ${email}.`
      };
    } catch (error) {
      console.error('SafeMate updateDirectAccount failed:', error);
      return { ok: false, message: directFailureMessage(error) };
    }
  }

  async revokeAccessByPhone(phone: string | null | undefined): Promise<SafegateResult> {
    try {
      const users = await this.fetchSubUsers();
      const matches = users.filter((user) => userMatchesPhone(user, String(phone || '')));
      if (matches.length === 0) {
        return {
          ok: true,
          skipped: true,
          message: 'No SafeMate account matched this phone.'
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          skipped: true,
          message: 'Several SafeMate accounts match this phone, so none was removed. The database change was kept.'
        };
      }
      return await this.revokeAccount(matches[0].account);
    } catch (error) {
      console.error('SafeMate revokeAccessByPhone failed:', error);
      return { ok: false, message: unreachableMessage(error) };
    }
  }

  async revokeAccount(account: string | null | undefined): Promise<SafegateResult> {
    try {
      const target = String(account || '').trim();
      if (!target) {
        return { ok: false, skipped: true, message: 'Missing SafeMate account.' };
      }
      if (isProtectedSafemateAccount(target)) {
        return {
          ok: false,
          skipped: true,
          message: `SafeMate account ${target} is protected and was not removed.`
        };
      }
      const data = await postPhp('delete_user.php', { account: target });
      if (cloudFailed(data)) {
        return {
          ok: false,
          account: target,
          message: `SafeMate could not remove account ${target} (errno ${errnoOf(data)}).`
        };
      }
      return { ok: true, account: target, message: `SafeMate account ${target} was removed.` };
    } catch (error) {
      console.error('SafeMate revokeAccount failed:', error);
      return { ok: false, message: unreachableMessage(error) };
    }
  }

  /** Remove a SafeMate account only. Does not read or write CMS tables. */
  async deleteDirectAccount(account: string | null | undefined): Promise<SafegateResult> {
    try {
      const target = String(account || '').trim();
      if (!target) {
        return { ok: false, message: 'Missing SafeMate account.' };
      }
      if (isProtectedSafemateAccount(target)) {
        return {
          ok: false,
          skipped: true,
          message: `SafeMate account ${target} is protected and was not removed.`
        };
      }
      const data = await postPhp('delete_user.php', { account: target });
      if (cloudFailed(data)) {
        return {
          ok: false,
          account: target,
          message: `SafeMate could not remove account ${target} (errno ${errnoOf(data)}).`
        };
      }
      return { ok: true, account: target, message: `SafeMate account ${target} was removed from SafeMate.` };
    } catch (error) {
      console.error('SafeMate deleteDirectAccount failed:', error);
      return { ok: false, message: directFailureMessage(error) };
    }
  }

  async syncGrantForUser(user: SafegateUserRef, expiryDate?: string | null): Promise<SafegateResult> {
    if (!String(user.phone || '').trim()) {
      return {
        ok: true,
        skipped: true,
        message: 'SafeMate was not updated because this user has no phone number. The database change was kept.'
      };
    }
    return this.grantAccess({
      phone: user.phone,
      email: user.email,
      name: user.name,
      expiryDate: expiryDate || null
    });
  }

  async syncRevokeAfterGateRemoval(user: SafegateUserRef): Promise<SafegateResult> {
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) as cnt FROM apartment_gate_access WHERE user_id = ?`,
        [user.id]
      );
      const remaining = Number((rows as Array<{ cnt: number }>)[0]?.cnt || 0);
      if (remaining > 0) {
        return {
          ok: true,
          skipped: true,
          message: 'SafeMate account kept because this person still has gate access on another apartment.'
        };
      }
    } catch (error) {
      console.error('SafeMate remaining-access check failed:', error);
      return {
        ok: false,
        skipped: true,
        message: 'SafeMate was not updated because remaining gate access could not be checked. The database change was kept.'
      };
    }

    if (!String(user.phone || '').trim()) {
      return {
        ok: true,
        skipped: true,
        message: 'SafeMate was not updated because this user has no phone number. The database change was kept.'
      };
    }
    return this.revokeAccessByPhone(user.phone);
  }
}

export const safegateService = new SafegateService();
