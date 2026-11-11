/**
 * Import main gate access contacts from Excel into apartment_gate_access.
 *
 * Source: docs/maingate/Main gate access - Contacts.xlsx
 *
 * Relation mapping (sheet → DB):
 *   Owner                         → Owner
 *   Rental / Tenant               → Tenant
 *   Family / Son / Daughter / Mother / Father / Brother / Sister / in-law → Family
 *   Helper / Staff                → Staff
 *   empty / Admin                 → skip (no access)
 *
 * Behavior:
 *   - Resolves apartments by block + unofficial unit (falls back to official)
 *   - Expands unit ranges (e.g. "201 - 204")
 *   - Finds users by flexible phone match; creates Member users when missing
 *   - Upserts apartment_gate_access linked to the correct apartment(s)
 *   - Links apartment_users by sheet status:
 *       Owner  → primary if matches apartments.owner_id, else additional (secondary) owner
 *       Tenant / Rental → tenant in apartment_users (+ apartments.renter_id when empty)
 *       Family / Staff / Guest / Other → gate access only
 *   - Does NOT replace an existing primary owner_id when the sheet lists a different Owner
 *   - Logs owner name/phone mismatches vs registered DB owner
 *   - Writes a report under docs/maingate/
 *
 * Rollback (manual):
 *   Delete gate-access rows created after this migration's run, and optional
 *   Member users created solely for this import (see report). Prefer restoring
 *   from backup if a full revert is needed.
 *
 * Re-run: remove the success row from `migrations` for this name, then migrate again.
 * Upserts are idempotent; existing users are reused by phone.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

type GateRelation = 'Owner' | 'Tenant' | 'Family' | 'Staff' | 'Guest' | 'Other';

export interface SheetContact {
  rowIndex: number;
  phoneRaw: string;
  name: string;
  block: string;
  aptRaw: string;
  relationRaw: string;
}

interface ApartmentRow {
  id: number;
  block: string;
  official: string;
  unofficial: string;
  ownerId: number | null;
  ownerName: string | null;
  ownerPhone: string | null;
  renterId: number | null;
}

interface UserRow {
  id: number;
  username: string;
  phone: string | null;
  email: string | null;
}

interface OwnerMismatch {
  type: 'NAME' | 'PHONE' | 'NAME_AND_PHONE' | 'NO_OWNER_IN_DB';
  apartmentLabel: string;
  apartmentId: number;
  sheetName: string;
  sheetPhone: string;
  dbOwnerId: number | null;
  dbOwnerName: string | null;
  dbOwnerPhone: string | null;
}

const EXCEL_RELATIVE_PATH = path.join('docs', 'maingate', 'Main gate access - Contacts.xlsx');

/**
 * Sheet unit typos → actual unofficial apartment number in DB.
 * H-302 does not exist; Assaker contacts belong on H-304.
 */
const SHEET_UNIT_CORRECTIONS: Record<string, string> = {
  'H|302': '304'
};

/**
 * Per-person sheet corrections (name is matched case-insensitively).
 * Used when only one contact on a unit is wrong (not the whole unit).
 */
const SHEET_PERSON_UNIT_CORRECTIONS: Array<{
  nameIncludes: string;
  fromBlock: string;
  fromApt: string;
  toApt: string;
}> = [
  { nameIncludes: 'eliana bassil', fromBlock: 'H', fromApt: '102', toApt: '104' }
];

function correctSheetUnit(block: string, aptNb: string): string {
  const key = `${block.toUpperCase()}|${String(aptNb).trim()}`;
  return SHEET_UNIT_CORRECTIONS[key] || aptNb;
}

function correctContactApartment(contact: SheetContact): { block: string; aptRaw: string } {
  const block = contact.block.toUpperCase();
  const aptRaw = String(contact.aptRaw || '').trim();
  const name = normalizeName(contact.name);

  for (const rule of SHEET_PERSON_UNIT_CORRECTIONS) {
    if (
      name.includes(rule.nameIncludes) &&
      block === rule.fromBlock.toUpperCase() &&
      aptRaw === rule.fromApt
    ) {
      return { block, aptRaw: rule.toApt };
    }
  }

  return { block, aptRaw };
}

function digitsOnly(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Split multi-number phone fields like "+961… ::: +1…". */
function phoneSegments(phone: unknown): string[] {
  const raw = String(phone ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:::|;|\/|,|\|)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Phone keys for fuzzy match (Lebanon local / intl / leading-zero variants). */
function phoneMatchKeys(phone: unknown): string[] {
  const keys = new Set<string>();

  for (const segment of phoneSegments(phone).length ? phoneSegments(phone) : [String(phone ?? '')]) {
    let d = digitsOnly(segment);
    if (!d) continue;

    while (d.startsWith('00')) d = d.slice(2);
    keys.add(d);

    if (d.startsWith('961') && d.length > 3) {
      const national = d.slice(3);
      keys.add(national);
      const nationalNoZero = national.replace(/^0+/, '');
      if (nationalNoZero) {
        keys.add(nationalNoZero);
        keys.add('0' + nationalNoZero);
        keys.add('961' + nationalNoZero);
      }
    }

    const core = d.replace(/^0+/, '');
    if (core) {
      keys.add(core);
      if (core.length >= 7) keys.add(core.slice(-7));
      if (core.length >= 8) keys.add(core.slice(-8));
    }
  }

  return [...keys].filter(Boolean);
}

function phonesMatch(a: unknown, b: unknown): boolean {
  const ka = new Set(phoneMatchKeys(a));
  if (!ka.size) return false;
  for (const k of phoneMatchKeys(b)) {
    if (ka.has(k)) return true;
  }

  // Fallback: sheet national last-7 appears inside DB digit blob (multi-number fields)
  const sheetDigits = digitsOnly(a).replace(/^0+/, '');
  const dbDigits = digitsOnly(b);
  if (sheetDigits.length >= 7 && dbDigits.includes(sheetDigits.slice(-7))) return true;

  return false;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function namesSimilar(a: string, b: string, mode: 'loose' | 'strict' = 'loose'): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = new Set(na.split(' ').filter((t) => t.length > 1));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return false;

  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  const minSize = Math.min(ta.size, tb.size);
  if (mode === 'strict') {
    // Require 2 shared tokens when both names have first+last (avoids "Khoury"-only hits)
    if (minSize >= 2) return overlap >= 2;
    return overlap >= 1;
  }
  return overlap >= 1 && overlap / minSize >= 0.5;
}

function isWeakPhone(phone: unknown): boolean {
  const d = digitsOnly(phone);
  if (!d || d.length < 7) return true;
  if (/^9+$/.test(d)) return true;
  if (d === '999661') return true;
  return false;
}

function apartmentLabel(apt: ApartmentRow): string {
  if (apt.unofficial && apt.official && apt.unofficial !== apt.official) {
    return `${apt.block}-${apt.unofficial} (official ${apt.official})`;
  }
  return `${apt.block}-${apt.unofficial || apt.official}`;
}

function mapRelation(raw: string): GateRelation | null {
  const v = raw.trim();
  if (!v) return null;

  const lower = v.toLowerCase();
  if (lower === 'admin') return null;
  if (lower === 'owner') return 'Owner';
  if (lower === 'rental' || lower === 'tenant') return 'Tenant';
  if (lower === 'family') return 'Family';
  if (lower.includes('helper') || lower.includes('staff')) return 'Staff';
  if (lower.includes('guest')) return 'Guest';

  if (
    /\bson\b/.test(lower) ||
    /\bdaughter\b/.test(lower) ||
    /\bmother\b/.test(lower) ||
    /\bfather\b/.test(lower) ||
    /\bbrother\b/.test(lower) ||
    /\bsister\b/.test(lower) ||
    /\bwife\b/.test(lower) ||
    /\bhusband\b/.test(lower) ||
    lower.includes('in law') ||
    lower.includes('in-law') ||
    lower.includes('family')
  ) {
    return 'Family';
  }

  return 'Other';
}

/** Expand "101-104", "201 - 202", or single "303". */
function expandAptNumbers(raw: string): string[] {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) return [];

  const rangeMatch = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 20) {
      return [cleaned];
    }
    const out: string[] = [];
    for (let n = start; n <= end; n++) out.push(String(n));
    return out;
  }

  return [cleaned];
}

function formatPhoneForStorage(phoneRaw: string): string {
  const digits = digitsOnly(phoneRaw);
  if (!digits) return phoneRaw.trim();
  // Prefer compact international-ish storage for Lebanese mobiles
  let d = digits;
  while (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('961')) {
    const national = d.slice(3).replace(/^0+/, '');
    if (national) return `+961${national}`;
  }
  if (d.length === 8 && d.startsWith('0')) {
    return `+961${d.slice(1)}`;
  }
  if (d.length === 7 || d.length === 8) {
    return `+961${d.replace(/^0+/, '')}`;
  }
  return phoneRaw.trim();
}

function loadSheetContacts(excelPath: string): SheetContact[] {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  const contacts: SheetContact[] = [];
  rows.forEach((row, idx) => {
    const phoneRaw = String(row['Phone Number'] ?? '').trim();
    const name = String(row.Name ?? '').trim();
    const block = String(row.Block ?? '').trim().toUpperCase();
    const aptRaw = String(row['Appt Nb.'] ?? '').trim();
    const relationRaw = String(row['Owner Or Rental'] ?? '').trim();

    if (!phoneRaw && !name && !block && !aptRaw) return;

    contacts.push({
      rowIndex: idx + 2, // header is row 1
      phoneRaw,
      name,
      block,
      aptRaw,
      relationRaw
    });
  });

  return contacts;
}

function buildApartmentIndexes(apartments: ApartmentRow[]): {
  byUnofficial: Map<string, ApartmentRow>;
  byOfficial: Map<string, ApartmentRow>;
} {
  const byUnofficial = new Map<string, ApartmentRow>();
  const byOfficial = new Map<string, ApartmentRow>();

  for (const apt of apartments) {
    const block = apt.block.toUpperCase();
    if (apt.unofficial) byUnofficial.set(`${block}|${apt.unofficial}`, apt);
    if (apt.official) byOfficial.set(`${block}|${apt.official}`, apt);
  }

  return { byUnofficial, byOfficial };
}

function isSameAsRegisteredOwner(contact: SheetContact, apt: ApartmentRow, user: UserRow): boolean {
  if (!apt.ownerId) return false;
  if (user.id === apt.ownerId) return true;
  if (isSamePersonName(contact.name, apt.ownerName || '')) return true;
  if (phonesMatch(contact.phoneRaw, apt.ownerPhone)) return true;
  return false;
}

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [table]
  );
  return (rows as any[]).length > 0;
}

/**
 * Link sheet contact into apartment_users (and renter_id cache) based on relation.
 * Never demotes/replaces an existing primary owner.
 */
async function linkApartmentMembership(
  apt: ApartmentRow,
  user: UserRow,
  relation: GateRelation,
  contact: SheetContact,
  hasApartmentUsers: boolean,
  counters: {
    secondaryOwners: number;
    primaryOwnerLinks: number;
    tenantsLinked: number;
    renterIdsSet: number;
  }
): Promise<void> {
  if (!hasApartmentUsers) return;
  if (relation !== 'Owner' && relation !== 'Tenant') return;

  if (relation === 'Owner') {
    if (!apt.ownerId) {
      // No primary owner yet — promote this sheet Owner
      await db.query(
        `
          INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
          VALUES (?, ?, 'owner', 1)
          ON DUPLICATE KEY UPDATE is_primary = 1
        `,
        [apt.id, user.id]
      );
      await db.query(
        `UPDATE apartments SET owner_id = ?, owner_name = ?, owner_phone = ? WHERE id = ? AND owner_id IS NULL`,
        [user.id, user.username, user.phone, apt.id]
      );
      apt.ownerId = user.id;
      apt.ownerName = user.username;
      apt.ownerPhone = user.phone;
      counters.primaryOwnerLinks++;
      return;
    }

    if (isSameAsRegisteredOwner(contact, apt, user)) {
      // Ensure registered primary is linked; do not add a duplicate sheet identity as secondary
      await db.query(
        `
          INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
          VALUES (?, ?, 'owner', 1)
          ON DUPLICATE KEY UPDATE is_primary = 1
        `,
        [apt.id, apt.ownerId]
      );
      counters.primaryOwnerLinks++;
      return;
    }

    // Additional / secondary owner
    await db.query(
      `
        INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
        VALUES (?, ?, 'owner', 0)
        ON DUPLICATE KEY UPDATE role = 'owner'
      `,
      [apt.id, user.id]
    );
    counters.secondaryOwners++;
    return;
  }

  // Tenant
  await db.query(
    `
      INSERT INTO apartment_users (apartment_id, user_id, role, is_primary)
      VALUES (?, ?, 'tenant', 0)
      ON DUPLICATE KEY UPDATE role = 'tenant'
    `,
    [apt.id, user.id]
  );
  counters.tenantsLinked++;

  if (!apt.renterId) {
    await db.query(`UPDATE apartments SET renter_id = ? WHERE id = ? AND renter_id IS NULL`, [
      user.id,
      apt.id
    ]);
    apt.renterId = user.id;
    counters.renterIdsSet++;
  }
}

function resolveApartment(
  block: string,
  aptNb: string,
  indexes: ReturnType<typeof buildApartmentIndexes>
): ApartmentRow | null {
  const key = `${block}|${aptNb}`;
  return indexes.byUnofficial.get(key) || indexes.byOfficial.get(key) || null;
}

function buildUserPhoneIndex(users: UserRow[]): Map<string, UserRow> {
  const map = new Map<string, UserRow>();
  for (const user of users) {
    for (const key of phoneMatchKeys(user.phone)) {
      if (!map.has(key)) map.set(key, user);
    }
  }
  return map;
}

function findUserByPhone(
  phoneRaw: string,
  index: Map<string, UserRow>,
  users: UserRow[]
): UserRow | null {
  for (const key of phoneMatchKeys(phoneRaw)) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  // Multi-number / odd formats not fully indexed
  for (const user of users) {
    if (user.phone && phonesMatch(phoneRaw, user.phone)) return user;
  }
  return null;
}

function findUserByExactName(name: string, users: UserRow[]): UserRow | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const exact = users.filter((u) => normalizeName(u.username) === normalized);
  // Prefer oldest (lowest id) when duplicates already exist from prior runs
  if (!exact.length) return null;
  return exact.sort((a, b) => a.id - b.id)[0];
}

/** Same person only if exact name, or first name matches + strict surname overlap. */
function isSamePersonName(sheetName: string, userName: string): boolean {
  if (!sheetName.trim()) return true;
  if (normalizeName(sheetName) === normalizeName(userName)) return true;

  const a = normalizeName(sheetName).split(' ').filter((t) => t.length > 1);
  const b = normalizeName(userName).split(' ').filter((t) => t.length > 1);
  if (!a.length || !b.length) return false;
  // Different given names on a shared phone ⇒ different people (e.g. Jocelyne vs Rami El Mir)
  if (a[0] !== b[0]) return false;

  return namesSimilar(sheetName, userName, 'strict');
}

/**
 * Resolve sheet contact → user.
 * When a phone matches an existing user but the sheet name is a different person,
 * keep the sheet identity (create/reuse by exact name) for ALL relations — not only Owner.
 * Example: Jocelyne El Mir shares a number listed on Rami El Mir → must stay separate.
 */
function resolveUserForContact(
  contact: SheetContact,
  _resolvedApts: ApartmentRow[],
  users: UserRow[],
  userByPhone: Map<string, UserRow>,
  _usersById: Map<number, UserRow>
): UserRow | null {
  if (contact.phoneRaw) {
    const byPhone = findUserByPhone(contact.phoneRaw, userByPhone, users);
    if (byPhone) {
      if (isSamePersonName(contact.name, byPhone.username)) {
        return byPhone;
      }

      // Different person on a shared / family phone — do not fold into the phone match
      return null;
    }
  }

  // Exact sheet name only — no fuzzy merge into similarly spelled owners
  if (contact.name) {
    return findUserByExactName(contact.name, users);
  }

  return null;
}

export async function runMigration(
  ctx: MigrationContext,
  options?: { contacts?: SheetContact[] }
): Promise<void> {
  let contacts: SheetContact[];
  let sourceLabel = EXCEL_RELATIVE_PATH;

  if (options?.contacts) {
    contacts = options.contacts;
    sourceLabel = 'embedded contacts (no Excel read)';
    ctx.log(`Using ${contacts.length} embedded contact(s) (no Excel read).`);
  } else {
    const excelPath = path.join(__dirname, '..', EXCEL_RELATIVE_PATH);
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel file not found: ${excelPath}`);
    }

    ctx.log(`Reading contacts from ${EXCEL_RELATIVE_PATH}`);
    contacts = loadSheetContacts(excelPath);
    ctx.log(`Loaded ${contacts.length} non-empty sheet row(s).`);
  }

  const [aptRows] = await db.query(`
    SELECT
      a.id,
      a.floor AS block,
      CAST(a.apartment_number AS CHAR) AS official,
      CAST(a.apartment_number_unofficial AS CHAR) AS unofficial,
      a.owner_id AS ownerId,
      a.renter_id AS renterId,
      ou.username AS ownerName,
      ou.phone AS ownerPhone
    FROM apartments a
    LEFT JOIN users ou ON ou.id = a.owner_id
  `);

  const apartments = (aptRows as any[]).map((row) => ({
    id: Number(row.id),
    block: String(row.block || '').toUpperCase(),
    official: String(row.official || '').trim(),
    unofficial: String(row.unofficial || '').trim(),
    ownerId: row.ownerId != null ? Number(row.ownerId) : null,
    renterId: row.renterId != null ? Number(row.renterId) : null,
    ownerName: row.ownerName || null,
    ownerPhone: row.ownerPhone || null
  })) as ApartmentRow[];

  const aptIndexes = buildApartmentIndexes(apartments);
  const hasApartmentUsers = await tableExists('apartment_users');
  if (!hasApartmentUsers) {
    ctx.log('WARNING: apartment_users table missing — will only update gate access (not tenants/secondary owners).');
  }

  const [userRows] = await db.query(`
    SELECT id, username, phone, email FROM users
  `);
  const users = (userRows as any[]).map((row) => ({
    id: Number(row.id),
    username: String(row.username || ''),
    phone: row.phone || null,
    email: row.email || null
  })) as UserRow[];

  const userByPhone = buildUserPhoneIndex(users);
  const usersById = new Map<number, UserRow>(users.map((u) => [u.id, u]));

  const reportLines: string[] = [];
  const pushReport = (line: string) => {
    reportLines.push(line);
    ctx.log(line);
  };

  const ownerMismatches: OwnerMismatch[] = [];
  const missingApartments: Array<{
    rowIndex: number;
    name: string;
    phone: string;
    block: string;
    aptNb: string;
    relationRaw: string;
  }> = [];
  const skipped: Array<{ rowIndex: number; reason: string; detail: string }> = [];

  let createdUsers = 0;
  let reusedUsers = 0;
  let upsertedAccess = 0;
  let skippedNoRelation = 0;
  let skippedAdmin = 0;
  let phonesFilled = 0;
  const membershipCounters = {
    secondaryOwners: 0,
    primaryOwnerLinks: 0,
    tenantsLinked: 0,
    renterIdsSet: 0
  };

  const createdUserIds: number[] = [];

  pushReport('=== Main gate access Excel import ===');
  pushReport(`File: ${sourceLabel}`);
  pushReport(`Started: ${new Date().toISOString()}`);
  pushReport('');

  let processed = 0;
  for (const contact of contacts) {
    processed++;
    if (processed === 1 || processed % 25 === 0 || processed === contacts.length) {
      ctx.log(`Processing contact ${processed}/${contacts.length} (sheet row ${contact.rowIndex})...`);
    }
    const relation = mapRelation(contact.relationRaw);

    if (relation === null) {
      if (contact.relationRaw.trim().toLowerCase() === 'admin') {
        skippedAdmin++;
        skipped.push({
          rowIndex: contact.rowIndex,
          reason: 'admin',
          detail: `${contact.name} ${contact.phoneRaw}`
        });
      } else {
        skippedNoRelation++;
        skipped.push({
          rowIndex: contact.rowIndex,
          reason: 'empty-relation-no-access',
          detail: `${contact.name || '(no name)'} ${contact.phoneRaw} ${contact.block}${contact.aptRaw}`
        });
      }
      continue;
    }

    if (!contact.block || !contact.aptRaw) {
      skipped.push({
        rowIndex: contact.rowIndex,
        reason: 'missing-apartment',
        detail: `${contact.name} ${contact.phoneRaw} relation=${contact.relationRaw}`
      });
      continue;
    }

    if (!contact.phoneRaw && !contact.name) {
      skipped.push({
        rowIndex: contact.rowIndex,
        reason: 'missing-identity',
        detail: `${contact.block}-${contact.aptRaw}`
      });
      continue;
    }

    const corrected = correctContactApartment(contact);
    const aptNumbers = expandAptNumbers(corrected.aptRaw).map((n) =>
      correctSheetUnit(corrected.block, n)
    );
    const resolvedApts: ApartmentRow[] = [];
    for (const aptNb of aptNumbers) {
      const apt = resolveApartment(corrected.block, aptNb, aptIndexes);
      if (apt) {
        resolvedApts.push(apt);
      } else {
        missingApartments.push({
          rowIndex: contact.rowIndex,
          name: contact.name,
          phone: contact.phoneRaw,
          block: corrected.block,
          aptNb,
          relationRaw: contact.relationRaw
        });
      }
    }

    if (!resolvedApts.length) {
      continue;
    }

    // Find or create user — owner mismatches keep exact sheet name/phone
    let user = resolveUserForContact(contact, resolvedApts, users, userByPhone, usersById);
    if (user) {
      reusedUsers++;
      // Only fill weak phones when this is clearly the same person
      if (isSamePersonName(contact.name, user.username) && contact.phoneRaw && isWeakPhone(user.phone)) {
        const phoneToStore = formatPhoneForStorage(contact.phoneRaw);
        await db.query(`UPDATE users SET phone = ? WHERE id = ?`, [phoneToStore, user.id]);
        user.phone = phoneToStore;
        for (const key of phoneMatchKeys(phoneToStore)) {
          if (!userByPhone.has(key)) userByPhone.set(key, user);
        }
        phonesFilled++;
      }
    } else {
      const displayName = contact.name || `Gate contact ${contact.phoneRaw || contact.rowIndex}`;
      const phoneToStore = contact.phoneRaw ? formatPhoneForStorage(contact.phoneRaw) : null;

      const [insertResult] = await db.query(
        `
          INSERT INTO users (username, email, phone, password, salt, status, role, wallet_enabled, notes)
          VALUES (?, NULL, ?, NULL, NULL, 'Active', 'Member', 0, ?)
        `,
        [
          displayName,
          phoneToStore,
          `Created by main-gate Excel import ${new Date().toISOString().slice(0, 10)} (sheet row ${contact.rowIndex})`
        ]
      );

      const newId = Number((insertResult as any).insertId);
      user = {
        id: newId,
        username: displayName,
        phone: phoneToStore,
        email: null
      };
      users.push(user);
      usersById.set(user.id, user);
      for (const key of phoneMatchKeys(phoneToStore)) {
        // Prefer exact sheet-name user for this phone going forward
        userByPhone.set(key, user);
      }
      createdUsers++;
      createdUserIds.push(newId);
    }

    for (const apt of resolvedApts) {
      await db.query(
        `
          INSERT INTO apartment_gate_access (apartment_id, user_id, relation, expiry_date)
          VALUES (?, ?, ?, NULL)
          ON DUPLICATE KEY UPDATE relation = VALUES(relation)
        `,
        [apt.id, user.id, relation]
      );
      upsertedAccess++;

      await linkApartmentMembership(
        apt,
        user,
        relation,
        contact,
        hasApartmentUsers,
        membershipCounters
      );

      if (relation === 'Owner') {
        if (!apt.ownerId) {
          ownerMismatches.push({
            type: 'NO_OWNER_IN_DB',
            apartmentLabel: apartmentLabel(apt),
            apartmentId: apt.id,
            sheetName: contact.name,
            sheetPhone: contact.phoneRaw,
            dbOwnerId: null,
            dbOwnerName: null,
            dbOwnerPhone: null
          });
        } else if (!isSameAsRegisteredOwner(contact, apt, user)) {
          const nameOk = namesSimilar(contact.name, apt.ownerName || '', 'strict');
          const phoneOk = phonesMatch(contact.phoneRaw, apt.ownerPhone);
          ownerMismatches.push({
            type: !nameOk && !phoneOk ? 'NAME_AND_PHONE' : !nameOk ? 'NAME' : 'PHONE',
            apartmentLabel: apartmentLabel(apt),
            apartmentId: apt.id,
            sheetName: contact.name,
            sheetPhone: contact.phoneRaw,
            dbOwnerId: apt.ownerId,
            dbOwnerName: apt.ownerName,
            dbOwnerPhone: apt.ownerPhone
          });
        }
      }
    }
  }

  pushReport('--- Summary ---');
  pushReport(`Upserted gate access links: ${upsertedAccess}`);
  pushReport(`Users reused (phone/name match): ${reusedUsers}`);
  pushReport(`Users created: ${createdUsers}`);
  pushReport(`Empty owner phones filled from sheet: ${phonesFilled}`);
  pushReport(`Primary owner links ensured: ${membershipCounters.primaryOwnerLinks}`);
  pushReport(`Secondary (additional) owners linked: ${membershipCounters.secondaryOwners}`);
  pushReport(`Tenants linked in apartment_users: ${membershipCounters.tenantsLinked}`);
  pushReport(`apartments.renter_id set (was empty): ${membershipCounters.renterIdsSet}`);
  pushReport(`Skipped empty relation (no access): ${skippedNoRelation}`);
  pushReport(`Skipped admin: ${skippedAdmin}`);
  pushReport(`Missing apartment unit lookups: ${missingApartments.length}`);
  pushReport(`Owner mismatches vs DB: ${ownerMismatches.length}`);
  pushReport('');

  pushReport('--- Owner mismatches (sheet Owner vs apartments.owner_id) ---');
  pushReport('Added as additional owners + Owner gate access when apartment found. Primary ownership NOT replaced.');
  if (!ownerMismatches.length) {
    pushReport('(none)');
  } else {
    for (const m of ownerMismatches) {
      pushReport(
        `[${m.type}] ${m.apartmentLabel} (apt #${m.apartmentId}) | sheet: ${m.sheetName} / ${m.sheetPhone} | db: ${m.dbOwnerName || '-'} / ${m.dbOwnerPhone || '-'} (user #${m.dbOwnerId ?? '-'})`
      );
    }
  }
  pushReport('');

  pushReport('--- Missing apartments ---');
  if (!missingApartments.length) {
    pushReport('(none)');
  } else {
    for (const m of missingApartments) {
      pushReport(
        `row ${m.rowIndex}: ${m.block}-${m.aptNb} | ${m.name} | ${m.phone} | ${m.relationRaw}`
      );
    }
  }
  pushReport('');

  pushReport('--- Created user IDs ---');
  pushReport(createdUserIds.length ? createdUserIds.join(', ') : '(none)');
  pushReport('');

  const reportDir = path.join(__dirname, '..', 'docs', 'maingate');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `import-report-${stamp}.txt`);
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
  ctx.log(`Wrote report: ${path.relative(path.join(__dirname, '..'), reportPath)}`);
}
