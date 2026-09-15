import {
  EXPLICIT_NO_ROLE_DB_VALUE,
  getAccountRole,
  getOnboardingState,
  normalizeUserRole,
  toDbRole,
} from './onboarding';

describe('Account role vs awaiting role (onboarding)', () => {
  it('maps new verified user with empty role to awaiting_role / pending', () => {
    expect(toDbRole('pending')).toBe('');
    expect(getOnboardingState('active', '')).toBe('awaiting_role');
    expect(getAccountRole('active', '')).toBe('pending');
    expect(normalizeUserRole('')).toBeNull();
  });

  it('persists explicit no-role as user in DB', () => {
    expect(toDbRole('user')).toBe(EXPLICIT_NO_ROLE_DB_VALUE);
    expect(getOnboardingState('active', 'user')).toBe('active');
    expect(getAccountRole('active', 'user')).toBe('user');
    expect(normalizeUserRole('user')).toBeNull();
  });

  it('does not treat explicit no-role as awaiting assignment', () => {
    expect(getAccountRole('active', 'user')).not.toBe('pending');
    expect(getOnboardingState('active', 'user')).not.toBe('awaiting_role');
  });

  it('keeps dashboard roles unchanged', () => {
    for (const role of ['admin', 'teacher', 'tutor', 'student', 'tutor_student'] as const) {
      expect(toDbRole(role)).toBe(role);
      expect(getAccountRole('active', role)).toBe(role);
      expect(getOnboardingState('active', role)).toBe('active');
      expect(normalizeUserRole(role)).toBe(role);
    }
  });

  it('teacher → none stores user and returns account_role user', () => {
    expect(toDbRole('user')).toBe('user');
    expect(getAccountRole('active', 'user')).toBe('user');
  });

  it('none → teacher restores dashboard role', () => {
    expect(toDbRole('teacher')).toBe('teacher');
    expect(getAccountRole('active', 'teacher')).toBe('teacher');
  });

  it('student → none stores user', () => {
    expect(getAccountRole('active', 'user')).toBe('user');
  });
});
