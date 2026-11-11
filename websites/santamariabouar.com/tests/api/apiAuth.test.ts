import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRequireApartmentAccess,
  createRequireApiUser,
  requireApiAdmin,
  requireApiSuperAdmin
} from '../../src/api/middleware/apiAuth';
import { getJwtSecret, signAccessToken } from '../../src/api/services/apiTokenService';
import type { ApiUser } from '../../src/api/types';
import { mockRequest, runMiddleware } from './helpers';

const users: Record<number, ApiUser> = {
  1: { id: 1, name: 'Owner', role: 'Member', status: 'Active', walletEnabled: true },
  2: { id: 2, name: 'Former', role: 'Member', status: 'Inactive', walletEnabled: false },
  3: { id: 3, name: 'Boss', role: 'Super Admin', status: 'Active', walletEnabled: false },
  4: { id: 4, name: 'Viewer', role: 'Admin', status: 'Active', walletEnabled: false }
};

const requireUser = createRequireApiUser(async (id) => users[id] || null);

function authHeader(userId: number, role: string) {
  return { authorization: `Bearer ${signAccessToken(userId, role, getJwtSecret()!)}` };
}

test('missing bearer token returns 401', async () => {
  const { response, nextCalled } = await runMiddleware(requireUser, mockRequest());
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.ok(response.body.error.message);
});

test('valid token for an active user attaches apiUser', async () => {
  const req = mockRequest({ headers: authHeader(1, 'Member') });
  const { nextCalled, nextError } = await runMiddleware(requireUser, req);
  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
  assert.equal(req.apiUser?.id, 1);
});

test('token for an inactive user returns 401', async () => {
  const { response, nextCalled } = await runMiddleware(requireUser, mockRequest({ headers: authHeader(2, 'Member') }));
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
});

test('role is read from the database, not the token', async () => {
  const req = mockRequest({ headers: authHeader(1, 'Super Admin') });
  await runMiddleware(requireUser, req);
  assert.equal(req.apiUser?.role, 'Member');
  const { response, nextCalled } = await runMiddleware(requireApiAdmin, req);
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
});

test('admin area: Member is forbidden, Admin can read, only Super Admin can write', async () => {
  const member = mockRequest({ apiUser: users[1] });
  const admin = mockRequest({ apiUser: users[4] });
  const superAdmin = mockRequest({ apiUser: users[3] });

  assert.equal((await runMiddleware(requireApiAdmin, member)).response.statusCode, 403);
  assert.equal((await runMiddleware(requireApiAdmin, admin)).nextCalled, true);
  assert.equal((await runMiddleware(requireApiAdmin, superAdmin)).nextCalled, true);

  assert.equal((await runMiddleware(requireApiSuperAdmin, admin)).response.statusCode, 403);
  assert.equal((await runMiddleware(requireApiSuperAdmin, superAdmin)).nextCalled, true);
});

test("members cannot open another member's apartment", async () => {
  const ownership: Record<number, number[]> = { 1: [10, 11] };
  const guard = createRequireApartmentAccess(async (userId, apartmentId) =>
    (ownership[userId] || []).includes(apartmentId)
  );

  const own = await runMiddleware(guard, mockRequest({ apiUser: users[1], params: { id: '10' } as any }));
  assert.equal(own.nextCalled, true);

  const other = await runMiddleware(guard, mockRequest({ apiUser: users[1], params: { id: '99' } as any }));
  assert.equal(other.nextCalled, false);
  assert.equal(other.response.statusCode, 404);

  const invalid = await runMiddleware(guard, mockRequest({ apiUser: users[1], params: { id: 'abc' } as any }));
  assert.equal(invalid.response.statusCode, 400);
});
