const fs = require('fs');
const path = require('path');
const { loadDump } = require('./lib/wp-dump');
const { classifyPost, classifyTerm } = require('./lib/classify');

const ROOT = path.resolve(__dirname, '..');
const DUMP = path.resolve(ROOT, '..', 'solutech', 'zazoo_solutec', 'zazoo_solutec.sql');
const UPLOADS = path.resolve(ROOT, '..', 'solutech', 'name', 'public_html', 'wp-content', 'uploads');
const REPORT_JSON = path.join(ROOT, 'data', 'import-report.json');
const REPORT_MD = path.join(ROOT, 'data', 'import-report.md');

const SAFE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot']);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/wp-file-manager|redux/i.test(entry.name)) {
        out.push({ file: full, verdict: 'drop', reasons: ['risky-directory'] });
        continue;
      }
      walk(full, out);
      continue;
    }
    const lower = entry.name.toLowerCase();
    const ext = path.extname(lower);
    const reasons = [];
    if (lower === '.htaccess' || lower.endsWith('.php') || lower.endsWith('.phtml') || lower.endsWith('.phar')) {
      reasons.push('executable-name');
    }
    if (/\.php\./i.test(lower) || /\.(php|phtml)\.(jpg|png|gif)$/i.test(lower)) {
      reasons.push('double-extension');
    }
    if (!reasons.length && SAFE_EXT.has(ext)) {
      const fd = fs.openSync(full, 'r');
      const buf = Buffer.alloc(512);
      const n = fs.readSync(fd, buf, 0, 512, 0);
      fs.closeSync(fd);
      const head = buf.slice(0, n).toString('utf8');
      if (/<\?php|<\?=|<\s*script\b/i.test(head)) reasons.push('payload-header');
    } else if (!reasons.length && !SAFE_EXT.has(ext)) {
      reasons.push('unexpected-extension');
    }
    if (reasons.length) out.push({ file: path.relative(UPLOADS, full), verdict: 'drop', reasons });
  }
}

function summarize(rows) {
  const counts = {};
  rows.forEach((row) => {
    const key = `${row.type || 'file'}:${row.verdict}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function line(row) {
  const why = (row.reasons || []).join(', ') || 'ok';
  return `- ${row.verdict} ${row.type || 'file'} ${row.id || ''} ${row.title || row.file || ''} (${why})`;
}

function main() {
  console.log('Loading dump...');
  const dump = loadDump(DUMP);
  console.log(`Posts: ${dump.posts.length}, meta groups: ${dump.metaByPost.size}`);

  const content = [];
  dump.posts.forEach((post) => {
    const id = Number(post.ID);
    const meta = dump.metaByPost.get(id) || {};
    const extra = meta._elementor_data || '';
    const result = classifyPost(post, extra);
    if (result.verdict === 'skip' && result.reasons[0] === 'not-content') return;
    if (result.verdict === 'skip' && String(result.reasons[0] || '').startsWith('status-')) return;
    if (result.verdict === 'skip' && String(result.reasons[0] || '').startsWith('type-')) return;
    content.push(result);
  });

  const termById = new Map(dump.terms.map((term) => [Number(term.term_id), term]));
  dump.taxonomies.forEach((tax) => {
    const term = termById.get(Number(tax.term_id));
    if (!term) return;
    const result = classifyTerm(term, tax);
    if (result.verdict === 'skip') return;
    content.push(result);
  });

  const files = [];
  console.log('Scanning uploads...');
  walk(UPLOADS, files);

  const keptIds = content.filter((row) => row.verdict === 'keep').map((row) => row.id);
  const report = {
    generatedAt: new Date().toISOString(),
    dump: DUMP,
    counts: summarize(content),
    fileCounts: summarize(files),
    keptIds,
    rows: content,
    files
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const interesting = content.filter((row) => row.verdict !== 'skip');
  const md = [
    '# Solutec import scan',
    '',
    `Generated ${report.generatedAt}`,
    '',
    '## Counts',
    '',
    ...Object.entries(report.counts).map(([k, n]) => `- ${k}: ${n}`),
    '',
    '## Upload findings',
    '',
    ...Object.entries(report.fileCounts).map(([k, n]) => `- ${k}: ${n}`),
    '',
    `Suspicious files: ${files.length}`,
    '',
    '## Kept',
    '',
    ...content.filter((row) => row.verdict === 'keep').map(line),
    '',
    '## Review',
    '',
    ...content.filter((row) => row.verdict === 'review').map(line),
    '',
    '## Dropped (first 80)',
    '',
    ...content.filter((row) => row.verdict === 'drop').slice(0, 80).map(line),
    ''
  ];
  fs.writeFileSync(REPORT_MD, md.join('\n'));
  console.log(`Wrote ${REPORT_MD}`);
  console.log(JSON.stringify(report.counts, null, 2));
  console.log(`Suspicious files: ${files.length}`);
}

main();
