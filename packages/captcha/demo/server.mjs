import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule } from '../test/load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserDir = path.join(__dirname, '..', 'dist', 'browser');
const port = Number(process.env.PORT || 4510);

const captcha = await loadModule('src/server/captcha.ts');
const secret = randomBytes(32).toString('hex');
const replayStore = new captcha.MemoryReplayStore();

const STATIC = {
  '/': [path.join(__dirname, 'index.html'), 'text/html; charset=utf-8'],
  '/demo.css': [path.join(__dirname, 'demo.css'), 'text/css; charset=utf-8'],
  '/demo.js': [path.join(__dirname, 'demo.js'), 'text/javascript; charset=utf-8'],
  '/captcha/captcha.js': [path.join(browserDir, 'captcha.js'), 'text/javascript; charset=utf-8'],
  '/captcha/captcha-worker.js': [path.join(browserDir, 'captcha-worker.js'), 'text/javascript; charset=utf-8'],
  '/captcha/captcha.css': [path.join(browserDir, 'captcha.css'), 'text/css; charset=utf-8']
};

/** Same strict policy the sites use: everything same-origin, no inline scripts. */
const CSP = "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'self'; object-src 'none'";

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' });
  res.end(body);
}

function json(res, status, value) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function intParam(url, name, fallback, min, max) {
  const raw = url.searchParams.get(name);
  const value = raw === null ? fallback : Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

const REASONS = {
  missing: 'No captcha token was sent (for example JavaScript is off, or a bot skipped the widget).',
  malformed: 'The token is not valid captcha data.',
  'bad-signature': 'The signature does not match: the challenge was not issued by this server or was changed.',
  expired: 'The challenge expired before it was used.',
  'wrong-scope': 'The token was issued for a different form.',
  'wrong-answer': 'The submitted number does not solve the challenge.',
  replayed: 'This token was already used once. Each token works only one time.'
};

async function handleSubmit(req, res, url) {
  const scope = url.searchParams.get('scope') || 'contact';
  if (!captcha.isValidScope(scope)) {
    json(res, 400, { ok: false, reason: 'bad-scope' });
    return;
  }
  const raw = await readBody(req);
  const type = req.headers['content-type'] || '';
  const fields = type.includes('application/json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
  const started = performance.now();
  const result = captcha.verifyCaptcha(typeof fields.captcha === 'string' ? fields.captcha : '', { secret, scope, replayStore });
  const verifyMs = Math.round((performance.now() - started) * 1000) / 1000;
  const { captcha: _token, ...rest } = fields;
  const body = { ok: result.ok, scope, reason: result.ok ? null : result.reason, explanation: result.ok ? 'Accepted.' : REASONS[result.reason], verifyMs, fields: rest };

  if (type.includes('application/json')) {
    json(res, result.ok ? 200 : 400, body);
    return;
  }
  const title = result.ok ? 'Accepted' : `Rejected: ${result.reason}`;
  send(
    res,
    result.ok ? 200 : 400,
    'text/html; charset=utf-8',
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/demo.css"></head>
<body class="result"><main class="card result-card ${result.ok ? 'is-ok' : 'is-bad'}"><h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(body.explanation)}</p><p>Scope: <code>${escapeHtml(scope)}</code> &middot; server check took ${verifyMs} ms</p>
<pre>${escapeHtml(JSON.stringify(rest, null, 2))}</pre><p><a href="/">Back to the demo</a></p></main></body></html>`
  );
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/captcha/challenge') {
      const scope = url.searchParams.get('scope') || 'contact';
      if (!captcha.isValidScope(scope)) {
        json(res, 400, { error: 'Invalid scope' });
        return;
      }
      const maxNumber = intParam(url, 'maxNumber', captcha.CAPTCHA_DEFAULT_MAX_NUMBER, 1_000, 10_000_000);
      const ttlMs = intParam(url, 'ttl', captcha.CAPTCHA_DEFAULT_TTL_MS, 1_000, 24 * 60 * 60_000);
      json(res, 200, captcha.createChallenge({ secret, scope, maxNumber, ttlMs }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/demo/submit') {
      await handleSubmit(req, res, url);
      return;
    }
    const file = req.method === 'GET' ? STATIC[url.pathname] : undefined;
    if (file) {
      send(res, 200, file[1], fs.readFileSync(file[0]));
      return;
    }
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (error) {
    console.error(error);
    send(res, 500, 'text/plain; charset=utf-8', 'Demo server error');
  }
});

server.listen(port, () => {
  console.log(`Captcha demo running at http://localhost:${port}  (Ctrl+C to stop)`);
});
