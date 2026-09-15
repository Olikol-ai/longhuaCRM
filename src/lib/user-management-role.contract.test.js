import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayRole } from './user-account-role.js';

describe('UserManagement displayRole (SSOT from API)', () => {
  it('new user awaiting assignment → pending', () => {
    assert.equal(
      displayRole({
        role: null,
        account_role: 'pending',
        onboarding_state: 'awaiting_role',
      }),
      'pending',
    );
  });

  it('admin-assigned none → user (Нет роли)', () => {
    assert.equal(
      displayRole({
        role: null,
        account_role: 'user',
        onboarding_state: 'active',
      }),
      'user',
    );
  });

  it('does not infer pending from null role when account_role is user', () => {
    assert.equal(displayRole({ role: null, account_role: 'user' }), 'user');
  });

  it('dashboard roles pass through', () => {
    assert.equal(displayRole({ role: 'teacher', account_role: 'teacher' }), 'teacher');
    assert.equal(displayRole({ role: 'student', account_role: 'student' }), 'student');
  });

  it('fallback: awaiting_role without account_role → pending', () => {
    assert.equal(displayRole({ role: null, onboarding_state: 'awaiting_role' }), 'pending');
  });

  it('fallback: active with null role and no account_role → user', () => {
    assert.equal(displayRole({ role: null, onboarding_state: 'active' }), 'user');
  });
});
