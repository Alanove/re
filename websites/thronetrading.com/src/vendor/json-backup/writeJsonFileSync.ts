/* @local/json-backup 1.0.0 - generated from packages/json-backup, do not edit */
import fs from 'node:fs';
import path from 'node:path';

export type JsonBackupTier = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface WriteJsonFileSyncOptions {
  /** Absolute or relative folder that holds per-file snapshot trees. Defaults to <site>/data-backups. */
  backupRoot?: string;
  /** Override "now" for tests. */
  now?: Date;
}

export const JSON_BACKUP_RETENTION: Record<JsonBackupTier, number> = {
  daily: 7,
  weekly: 8,
  monthly: 12,
  quarterly: 8
};

const TIERS: JsonBackupTier[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const CONTENT_DIRS = new Set(['data', 'content']);

export interface JsonBackupLocation {
  /** Site-level folder, next to data/ or content/ when the file lives under one of those. */
  backupRoot: string;
  /** Path under backupRoot. Nested files keep their path under data/ or content/. */
  snapshotName: string;
}

/**
 * Files directly in data/ or content/ snapshot as data-backups/<file>.
 * Files further down, such as data/articles/5.json, snapshot as data-backups/articles/5.json
 * so they stay next to the site data folder and do not collide on the file name alone.
 */
export function locateJsonBackup(filePath: string): JsonBackupLocation {
  const resolved = path.resolve(filePath);
  const segments = [path.basename(resolved)];
  let dir = path.dirname(resolved);
  while (true) {
    const base = path.basename(dir);
    if (CONTENT_DIRS.has(base)) {
      return {
        backupRoot: path.join(path.dirname(dir), 'data-backups'),
        snapshotName: path.join(...segments)
      };
    }
    const parent = path.dirname(dir);
    if (parent === dir || base === '.' || base === '..') {
      break;
    }
    segments.unshift(base);
    dir = parent;
  }
  return {
    backupRoot: path.join(path.dirname(resolved), 'data-backups'),
    snapshotName: path.basename(resolved)
  };
}

export function defaultBackupRoot(filePath: string): string {
  return locateJsonBackup(filePath).backupRoot;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** ISO week number (UTC date parts of the local calendar day). */
export function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${pad2(week)}`;
}

export function snapshotKeysFor(date: Date): Partial<Record<JsonBackupTier, string>> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const keys: Partial<Record<JsonBackupTier, string>> = {
    daily: `${year}-${pad2(month)}-${pad2(day)}`
  };
  if (date.getDay() === 0) {
    keys.weekly = isoWeekKey(date);
  }
  if (day === 1) {
    keys.monthly = `${year}-${pad2(month)}`;
    if (month === 1 || month === 4 || month === 7 || month === 10) {
      keys.quarterly = `${year}-Q${Math.ceil(month / 3)}`;
    }
  }
  return keys;
}

function pruneTier(tierDir: string, keep: number): void {
  if (!fs.existsSync(tierDir)) {
    return;
  }
  const files = fs
    .readdirSync(tierDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();
  for (const name of files.slice(keep)) {
    fs.unlinkSync(path.join(tierDir, name));
  }
}

function snapshotFileRoot(backupRoot: string, snapshotName: string): string {
  const root = path.resolve(backupRoot);
  const fileRoot = path.resolve(root, snapshotName);
  const relative = path.relative(root, fileRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`JSON backup path escapes data-backups: ${snapshotName}`);
  }
  return fileRoot;
}

function writeSnapshots(currentBytes: Buffer, snapshotName: string, backupRoot: string, now: Date): void {
  const fileRoot = snapshotFileRoot(backupRoot, snapshotName);
  const keys = snapshotKeysFor(now);
  for (const tier of TIERS) {
    const key = keys[tier];
    if (!key) {
      continue;
    }
    const tierDir = path.join(fileRoot, tier);
    fs.mkdirSync(tierDir, { recursive: true });
    const target = path.join(tierDir, `${key}.json`);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, currentBytes);
    }
    pruneTier(tierDir, JSON_BACKUP_RETENTION[tier]);
  }
}

function atomicWrite(filePath: string, text: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, text, 'utf8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Write a JSON text file. When the file already exists and the bytes change,
 * copy the previous contents into data-backups/<path>/{daily,weekly,monthly,quarterly}/
 * before replacing it. A file under data/articles/ keeps that relative path.
 * A period that already has a snapshot is left alone.
 */
export function writeJsonFileSync(
  filePath: string,
  jsonText: string,
  options: WriteJsonFileSyncOptions = {}
): void {
  const resolved = path.resolve(filePath);
  const text = jsonText.endsWith('\n') ? jsonText : `${jsonText}\n`;
  const now = options.now ?? new Date();
  const located = locateJsonBackup(resolved);
  const backupRoot = options.backupRoot ? path.resolve(options.backupRoot) : located.backupRoot;

  if (!fs.existsSync(resolved)) {
    atomicWrite(resolved, text);
    return;
  }

  const currentBytes = fs.readFileSync(resolved);
  const nextBytes = Buffer.from(text, 'utf8');
  if (currentBytes.equals(nextBytes)) {
    return;
  }

  writeSnapshots(currentBytes, located.snapshotName, backupRoot, now);
  atomicWrite(resolved, text);
}
