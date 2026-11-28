/**
 * One-shot copy of SQLite (prisma/dev.db) into MySQL (DATABASE_URL).
 * Refuses if MySQL already has users/households unless --force.
 *
 * Usage: npx tsx scripts/migrate-sqlite-to-mysql.ts [--force] [path/to/dev.db]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const require = createRequire(import.meta.url);
// better-sqlite3 may not be installed; prefer Node's built-in sqlite when available.
type SqliteDb = {
  prepare: (sql: string) => { all: (...params: unknown[]) => Record<string, unknown>[] };
  close: () => void;
};

function openSqlite(filePath: string): SqliteDb {
  try {
    // Node 22.5+ / 24
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (path: string, opts?: { readOnly?: boolean }) => SqliteDb;
    };
    return new DatabaseSync(filePath, { readOnly: true });
  } catch {
    const Database = require("better-sqlite3") as new (
      path: string,
      opts?: { readonly?: boolean }
    ) => SqliteDb;
    return new Database(filePath, { readonly: true });
  }
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(root, ".env"));

const force = process.argv.includes("--force");
const dbArg = process.argv.find((arg) => !arg.startsWith("-") && arg.endsWith(".db"));
const sqlitePath = path.resolve(
  root,
  dbArg ||
    (fs.existsSync(path.join(root, "prisma", "dev.db"))
      ? "prisma/dev.db"
      : "prisma/dev.db.sqlite-archive")
);

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith("mysql")) {
  console.error("DATABASE_URL must be a mysql:// URL");
  process.exit(1);
}

/** FK-safe insert order (parents before children). */
const TABLE_ORDER = [
  "User",
  "Session",
  "Account",
  "Verification",
  "Household",
  "Member",
  "Invite",
  "Business",
  "Category",
  "FxRate",
  "SavingsAccount",
  "CreditCard",
  "Loan",
  "Debt",
  "Customer",
  "BillableCategory",
  "PayslipTemplate",
  "Forecast",
  "Bill",
  "Income",
  "Expense",
  "LoanPayment",
  "CardCycle",
  "DebtRepayment",
  "BillPayment",
  "Service",
  "Invoice",
  "InvoiceLine",
  "InvoicePayment",
  "PayslipLine",
  "PayslipReceipt",
  "PayslipReceiptLine",
  "SavingsTxn",
] as const;

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

type MysqlColMeta = { name: string; dataType: string };

function coerceDateTime(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Prisma SQLite stores DateTime as Unix ms (sometimes seconds).
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms);
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      const ms = n < 1e12 ? n * 1000 : n;
      return new Date(ms);
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error(`Cannot coerce DateTime value: ${String(value)}`);
}

function toSqlValue(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return null;
  const t = dataType.toLowerCase();
  if (t === "datetime" || t === "timestamp") {
    return coerceDateTime(value);
  }
  if (t === "date") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const d = coerceDateTime(value);
    return d ? d.toISOString().slice(0, 10) : null;
  }
  if (t === "tinyint" || t === "boolean") {
    if (typeof value === "boolean") return value ? 1 : 0;
    return Number(value) ? 1 : 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  return value;
}

async function getColumnMeta(
  pool: mysql.Connection,
  table: string
): Promise<MysqlColMeta[]> {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return cols as MysqlColMeta[];
}

async function main() {
  const sqlite = openSqlite(sqlitePath);
  const pool = await mysql.createConnection(databaseUrl as string);

  try {
    const [userRows] = await pool.query("SELECT COUNT(*) AS c FROM `User`");
    const [hhRows] = await pool.query("SELECT COUNT(*) AS c FROM `Household`");
    const users = Number((userRows as mysql.RowDataPacket[])[0]?.c ?? 0);
    const households = Number((hhRows as mysql.RowDataPacket[])[0]?.c ?? 0);
    if ((users > 0 || households > 0) && !force) {
      console.error(
        `MySQL already has data (User=${users}, Household=${households}). Re-run with --force to wipe and re-import.`
      );
      process.exit(1);
    }

    if (force && (users > 0 || households > 0)) {
      console.log("`--force`: truncating MySQL tables…");
      await pool.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const table of [...TABLE_ORDER].reverse()) {
        await pool.query(`TRUNCATE TABLE ${quoteIdent(table)}`);
      }
      await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    await pool.query("SET FOREIGN_KEY_CHECKS = 0");

    let total = 0;
    for (const table of TABLE_ORDER) {
      let rows: Record<string, unknown>[];
      try {
        rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Record<
          string,
          unknown
        >[];
      } catch {
        console.log(`${table}: skipped (missing in SQLite)`);
        continue;
      }
      if (rows.length === 0) {
        console.log(`${table}: 0 rows`);
        continue;
      }
      const meta = await getColumnMeta(pool, table);
      const typeByCol = new Map(meta.map((c) => [c.name, c.dataType]));
      const columns = Object.keys(rows[0]).filter((c) => typeByCol.has(c));
      const colSql = columns.map(quoteIdent).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const sql = `INSERT INTO ${quoteIdent(table)} (${colSql}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map((col) =>
          toSqlValue(row[col], typeByCol.get(col) || "text")
        );
        await pool.query(sql, values);
      }
      total += rows.length;
      console.log(`${table}: ${rows.length} rows`);
    }

    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log(`\nImported ${total} rows from ${sqlitePath}`);

    sqlite.close();

    const archivePath = path.join(root, "prisma", "dev.db.sqlite-archive");
    if (path.resolve(sqlitePath) === path.join(root, "prisma", "dev.db")) {
      try {
        fs.renameSync(sqlitePath, archivePath);
        console.log(`Archived SQLite → ${archivePath}`);
      } catch (err) {
        // Windows may keep a lock briefly; fall back to copy + unlink.
        fs.copyFileSync(sqlitePath, archivePath);
        try {
          fs.unlinkSync(sqlitePath);
        } catch {
          console.warn(
            `Copied archive to ${archivePath} but could not delete ${sqlitePath}; delete it manually.`
          );
        }
        console.log(`Archived SQLite → ${archivePath}`);
        void err;
      }
    }
  } finally {
    try {
      sqlite.close();
    } catch {
      /* already closed */
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
