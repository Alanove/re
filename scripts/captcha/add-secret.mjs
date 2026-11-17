#!/usr/bin/env node
/**
 * Adds CAPTCHA_SECRET (a fresh random value per file) to a site's env files, if missing.
 * Usage (from the repo root): node scripts/captcha/add-secret.mjs websites/<domain> [more site folders]
 * .env.example gets a placeholder instead of a real secret.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sites = process.argv.slice(2);
if (sites.length === 0) {
  console.error('Usage: node scripts/captcha/add-secret.mjs websites/<domain> [...]');
  process.exit(1);
}

const FILES = ['.env', '.env.development', '.env.production', '.env.testing', '.env.example'];

for (const site of sites) {
  const dir = path.resolve(site);
  if (!fs.existsSync(dir)) {
    console.error(`Skipped ${site}: folder not found`);
    process.exitCode = 1;
    continue;
  }
  for (const name of FILES) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    if (/^CAPTCHA_SECRET=/m.test(content)) {
      console.log(`${site}/${name}: CAPTCHA_SECRET already set`);
      continue;
    }
    const value = name === '.env.example' ? 'replace-with-at-least-32-random-characters' : randomBytes(32).toString('hex');
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const block = [
      '',
      '# Self-hosted captcha (packages/captcha). Random secret, at least 32 characters; no external account needed.',
      `CAPTCHA_SECRET=${value}`,
      '# Optional. Proof-of-work size; higher is harder for bots and slower for people (default 100000).',
      'CAPTCHA_DIFFICULTY=100000',
      ''
    ].join(eol);
    fs.writeFileSync(file, content.replace(/\s*$/, '') + eol + block);
    console.log(`${site}/${name}: CAPTCHA_SECRET added`);
  }
}
