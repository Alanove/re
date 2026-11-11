import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import apiRoutes from '../../src/api/routes';

let server: Server;
let baseUrl = '';

before(async () => {
  const app = express();
  app.use('/api/v1', apiRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

after(() => {
  server.close();
});

test('member endpoints require a token', async () => {
  const res = await fetch(`${baseUrl}/me/dashboard`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.ok(body.error.message);
});

test('admin endpoints require a token', async () => {
  for (const path of ['/admin/dashboard', '/admin/transactions/1/receipt', '/admin/invoices/1/receipt']) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.status, 401, path);
  }
});

test('unknown routes return a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.message, 'Not found');
});

test('login validates required fields before touching the database', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: '' })
  });
  assert.equal(res.status, 400);
});

test('malformed JSON returns 400', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json'
  });
  assert.equal(res.status, 400);
});

test('API answers 503 in production without JWT_SECRET', async () => {
  const saved = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const res = await fetch(`${baseUrl}/me/dashboard`);
    assert.equal(res.status, 503);
  } finally {
    process.env.NODE_ENV = saved.env;
    if (saved.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved.secret;
  }
});
