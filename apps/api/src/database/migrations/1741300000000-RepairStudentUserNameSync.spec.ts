import {
  canSyncLinkedUser,
  isBlankStudentName,
  resolveRepairNameParts,
  RepairStudentUserNameSync1741300000000,
} from './1741300000000-RepairStudentUserNameSync';

describe('RepairStudentUserNameSync helpers', () => {
  it('treats null/empty/whitespace student name as blank', () => {
    expect(isBlankStudentName(null)).toBe(true);
    expect(isBlankStudentName('')).toBe(true);
    expect(isBlankStudentName('   ')).toBe(true);
    expect(isBlankStudentName('Бабаева Наталья')).toBe(false);
  });

  it('returns null parts for nameless student (must not sync User)', () => {
    expect(resolveRepairNameParts(null)).toBeNull();
    expect(resolveRepairNameParts('')).toBeNull();
    expect(resolveRepairNameParts('  ')).toBeNull();
    expect(canSyncLinkedUser({ firstName: '', lastName: '' })).toBe(false);
  });

  it('parses Student.name and allows user sync only when firstName is non-empty', () => {
    expect(resolveRepairNameParts('Бабаева Наталья')).toEqual({
      lastName: 'Бабаева',
      firstName: 'Наталья',
    });
    expect(canSyncLinkedUser({ firstName: 'Наталья', lastName: 'Бабаева' })).toBe(
      true,
    );

    // Single-token name lands in firstName — safe for users.first_name NOT NULL.
    expect(resolveRepairNameParts('Наталья')).toEqual({
      firstName: 'Наталья',
      lastName: '',
    });
    expect(canSyncLinkedUser({ firstName: 'Наталья', lastName: '' })).toBe(true);

    // lastName-only must not overwrite users.first_name with empty.
    expect(canSyncLinkedUser({ firstName: '', lastName: 'Бабаева' })).toBe(false);
  });
});

describe('RepairStudentUserNameSync migration (empty name)', () => {
  it('skips students without name and never writes empty users.first_name', async () => {
    const executed: Array<{ sql: string; params?: unknown[] }> = [];
    const queryRunner = {
      query: async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        if (sql.includes('TRIM(COALESCE(s.name, \'\')) = \'\'')) {
          return [
            {
              id: 'student-empty',
              email: 'empty@test.local',
              user_id: 'user-empty',
            },
          ];
        }
        if (sql.includes('TRIM(COALESCE(s.name, \'\')) <> \'\'')) {
          return [
            {
              id: 'student-empty-in-conflicts',
              user_id: 'user-2',
              email: 'ghost@test.local',
              name: '   ',
              first_name: null,
              last_name: null,
              composed: null,
              user_first_name: 'Old',
              user_last_name: 'Name',
            },
            {
              id: 'student-ok',
              user_id: 'user-ok',
              email: 'ok@test.local',
              name: 'Бабаева Наталья',
              first_name: 'Наталья',
              last_name: 'Баабева',
              composed: 'Баабева Наталья',
              user_first_name: 'Наталья',
              user_last_name: 'Баабева',
            },
          ];
        }
        return [];
      },
    };

    const migration = new RepairStudentUserNameSync1741300000000();
    await migration.up(queryRunner as never);

    const userUpdates = executed.filter((entry) =>
      /^\s*UPDATE users/i.test(entry.sql),
    );
    expect(userUpdates.length).toBeGreaterThanOrEqual(1);
    for (const update of userUpdates) {
      const firstName = String(update.params?.[1] ?? '');
      expect(firstName.trim().length).toBeGreaterThan(0);
      expect(update.params?.[1]).not.toBeNull();
      expect(update.params?.[1]).not.toBe('');
    }

    // Blank-name conflict row must not produce a users UPDATE.
    expect(
      userUpdates.some((entry) => entry.params?.[0] === 'user-2'),
    ).toBe(false);

    // Valid conflict still syncs linked user with non-empty first_name.
    const okUserUpdate = userUpdates.find(
      (entry) => entry.params?.[0] === 'user-ok',
    );
    expect(okUserUpdate).toBeTruthy();
    expect(okUserUpdate?.params?.[1]).toBe('Наталья');
    expect(okUserUpdate?.params?.[2]).toBe('Бабаева');
  });
});
