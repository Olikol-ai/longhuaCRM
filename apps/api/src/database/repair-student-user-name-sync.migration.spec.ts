import { RepairStudentUserNameSync1741300000000 } from './migrations/1741300000000-RepairStudentUserNameSync';

/**
 * Kept outside database/migrations/ so TypeORM glob
 * `migrations/*{.ts,.js}` does not load this file as a migration.
 */
describe('RepairStudentUserNameSync migration (empty name)', () => {
  it('skips students without name and never writes empty users.first_name', async () => {
    const executed: Array<{ sql: string; params?: unknown[] }> = [];
    const queryRunner = {
      query: async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        if (sql.includes("TRIM(COALESCE(s.name, '')) = ''")) {
          return [
            {
              id: 'student-empty',
              email: 'empty@test.local',
              user_id: 'user-empty',
            },
          ];
        }
        if (sql.includes("TRIM(COALESCE(s.name, '')) <> ''")) {
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

    expect(
      userUpdates.some((entry) => entry.params?.[0] === 'user-2'),
    ).toBe(false);

    const okUserUpdate = userUpdates.find(
      (entry) => entry.params?.[0] === 'user-ok',
    );
    expect(okUserUpdate).toBeTruthy();
    expect(okUserUpdate?.params?.[1]).toBe('Наталья');
    expect(okUserUpdate?.params?.[2]).toBe('Бабаева');
  });

  it('exports only the migration class (TypeORM-safe)', async () => {
    const mod = await import('./migrations/1741300000000-RepairStudentUserNameSync');
    const exportKeys = Object.keys(mod).sort();
    expect(exportKeys).toEqual(['RepairStudentUserNameSync1741300000000']);
    expect(typeof mod.RepairStudentUserNameSync1741300000000).toBe('function');
    const instance = new mod.RepairStudentUserNameSync1741300000000();
    expect(instance.name).toBe('RepairStudentUserNameSync1741300000000');
  });
});
