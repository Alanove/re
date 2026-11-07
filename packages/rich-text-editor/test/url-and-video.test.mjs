import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

async function loadModule(entryRelative) {
  const entry = path.join(srcDir, entryRelative);
  const outfile = path.join(os.tmpdir(), `rte-test-${path.basename(entryRelative, '.ts')}-${Date.now()}.mjs`);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  const mod = await import('file://' + outfile.replace(/\\/g, '/'));
  try {
    fs.unlinkSync(outfile);
  } catch {
    /* ignore */
  }
  return mod;
}

test('sanitizeUrl rejects javascript and data hrefs', async () => {
  const { sanitizeUrl } = await loadModule('url-sanitize.ts');
  assert.equal(sanitizeUrl('javascript:alert(1)', 'href'), null);
  assert.equal(sanitizeUrl('JAVASCRIPT:alert(1)', 'href'), null);
  assert.equal(sanitizeUrl('vbscript:msgbox(1)', 'href'), null);
  assert.equal(sanitizeUrl('data:text/html,hi', 'href'), null);
  assert.equal(sanitizeUrl('https://example.com', 'href'), 'https://example.com');
  assert.equal(sanitizeUrl('data:image/png;base64,abc', 'src'), 'data:image/png;base64,abc');
});

test('buildImgHtml escapes attributes', async () => {
  const { buildImgHtml } = await loadModule('url-sanitize.ts');
  const html = buildImgHtml({
    src: 'https://example.com/a.png',
    alt: 'say "hi" <x>',
    className: 'img"onerror=alert(1)',
  });
  assert.match(html, /src="https:\/\/example\.com\/a\.png"/);
  assert.match(html, /alt="say &quot;hi&quot; &lt;x&gt;"/);
  assert.match(html, /class="img&quot;onerror=alert\(1\)"/);
  assert.equal(buildImgHtml({ src: 'javascript:alert(1)' }), '');
});

test('buildVideoEmbed accepts YouTube and Vimeo only', async () => {
  const { buildVideoEmbed } = await loadModule('video-providers.ts');

  const yt = buildVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.ok(yt);
  assert.equal(yt.provider, 'youtube');
  assert.equal(yt.embedSrc, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.match(yt.embed, /youtube\.com\/embed\/dQw4w9WgXcQ/);

  const short = buildVideoEmbed('https://youtu.be/dQw4w9WgXcQ');
  assert.ok(short);
  assert.equal(short.embedSrc, 'https://www.youtube.com/embed/dQw4w9WgXcQ');

  const vim = buildVideoEmbed('https://vimeo.com/123456789');
  assert.ok(vim);
  assert.equal(vim.provider, 'vimeo');
  assert.equal(vim.embedSrc, 'https://player.vimeo.com/video/123456789');

  assert.equal(buildVideoEmbed('https://attacker.example/phishing'), null);
  assert.equal(buildVideoEmbed('https://example.com/video.mp4'), null);
  assert.equal(buildVideoEmbed(''), null);
  assert.equal(buildVideoEmbed(null), null);
});

// silence unused createRequire (kept for Windows path fallbacks if needed)
void createRequire;
