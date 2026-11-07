import assert from 'node:assert/strict';
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
  const outfile = path.join(
    os.tmpdir(),
    `rte-test-${path.basename(entryRelative, '.ts')}-${Date.now()}.mjs`
  );
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

test('formatEditorHtml indents nested block markup', async () => {
  const { formatEditorHtml } = await loadModule('html-format.ts');
  const input =
    '<div class="box"><p>Hello <strong>world</strong></p><ul><li>One</li><li>Two</li></ul></div>';
  const formatted = formatEditorHtml(input);

  assert.match(formatted, /^<div class="box">/);
  assert.match(formatted, /\n {2}<p>/);
  assert.match(formatted, /Hello <strong>world<\/strong>/);
  assert.match(formatted, /\n {2}<ul>/);
  assert.match(formatted, /\n {4}<li>/);
  assert.match(formatted, /\n {6}One/);
  assert.match(formatted, /\n {2}<\/ul>/);
  assert.match(formatted, /\n<\/div>$/);
});

test('collapseEditorHtml returns compact markup', async () => {
  const { collapseEditorHtml } = await loadModule('html-format.ts');
  const pretty = [
    '<div class="box">',
    '  <p>Hello <strong>world</strong></p>',
    '  <ul>',
    '    <li>One</li>',
    '    <li>Two</li>',
    '  </ul>',
    '</div>',
  ].join('\n');

  const collapsed = collapseEditorHtml(pretty);
  assert.equal(
    collapsed,
    '<div class="box"><p>Hello <strong>world</strong></p><ul><li>One</li><li>Two</li></ul></div>'
  );
});

test('format then collapse round-trips nested HTML', async () => {
  const { formatEditorHtml, collapseEditorHtml } = await loadModule('html-format.ts');
  const input =
    '<div class="box"><p>Hello <strong>world</strong></p><ul><li>One</li><li>Two</li></ul></div>';
  assert.equal(collapseEditorHtml(formatEditorHtml(input)), input);
});

test('inline spaces between tags survive format-then-collapse', async () => {
  const { formatEditorHtml, collapseEditorHtml } = await loadModule('html-format.ts');
  const input = '<p><strong>Bold</strong> <em>Italic</em></p>';
  const roundTrip = collapseEditorHtml(formatEditorHtml(input));
  assert.equal(roundTrip, input);
});

test('pre contents survive format-then-collapse', async () => {
  const { formatEditorHtml, collapseEditorHtml } = await loadModule('html-format.ts');
  const input = '<div><pre>line1\n  indented\nline3</pre><p>After</p></div>';
  const formatted = formatEditorHtml(input);
  assert.match(formatted, / {2}<pre>line1\n {2}indented\nline3<\/pre>/);
  assert.equal(collapseEditorHtml(formatted), input);
});
