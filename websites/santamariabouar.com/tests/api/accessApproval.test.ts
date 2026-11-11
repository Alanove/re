import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApartmentRole, resolveLinkAction } from '../../src/services/accessApprovalService';

const request = {
  apartments: [
    { id: 10, role: 'owner' as const },
    { id: 11, role: 'tenant' as const }
  ]
} as any;

test('apartment role falls back to the role on the request', () => {
  assert.equal(resolveApartmentRole(request, 10), 'owner');
  assert.equal(resolveApartmentRole(request, 11), 'tenant');
  assert.equal(resolveApartmentRole(request, 99), 'owner');
});

test('admin can override the requested role', () => {
  assert.equal(resolveApartmentRole(request, 10, { '10': 'tenant' }), 'tenant');
  assert.equal(resolveApartmentRole(request, 11, { '11': 'OWNER' }), 'owner');
  assert.equal(resolveApartmentRole(request, 11, { '11': 'nonsense' }), 'tenant');
});

test('tenants are always added as tenants', () => {
  assert.equal(resolveLinkAction('tenant', true, 'transfer_primary'), 'add_tenant');
  assert.equal(resolveLinkAction('tenant', false), 'add_tenant');
});

test('owner becomes primary when the apartment has none', () => {
  assert.equal(resolveLinkAction('owner', false, 'transfer_primary'), 'set_primary');
});

test('owner is added as co-owner unless a transfer is requested', () => {
  assert.equal(resolveLinkAction('owner', true), 'add_owner');
  assert.equal(resolveLinkAction('owner', true, 'TRANSFER_PRIMARY'), 'transfer_primary');
});
