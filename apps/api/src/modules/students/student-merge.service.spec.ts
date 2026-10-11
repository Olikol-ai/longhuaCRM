import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isSaturdayFourteenHundred,
  lessonScheduleRowsEqual,
  recurrenceScheduleRowsEqual,
} from './student-merge-schedule-guard';

describe('StudentMergeService contract', () => {
  const source = readFileSync(join(__dirname, 'student-merge.service.ts'), 'utf8');

  it('transfers balances through ledger merge_in / merge_out', () => {
    expect(source).toContain("operationType: 'merge_out'");
    expect(source).toContain("operationType: 'merge_in'");
    expect(source).toContain('StudentBalanceLedgerService.mergeOutKey');
    expect(source).toContain('primaryBefore + secondaryBefore');
  });

  it('deduplicates group memberships during merge', () => {
    expect(source).toContain('mergeGroupMembers');
  });

  it('marks secondary profile inactive with merged_into_student_id', () => {
    expect(source).toContain('mergedIntoStudentId: primary.id');
    expect(source).toContain("status: 'inactive'");
  });

  it('writes audit log for merge operation', () => {
    expect(source).toContain("action: 'student_merge'");
  });

  it('treats path-param student as primary and never auto-picks by heuristics', () => {
    expect(source).toContain('primaryStudentId');
    expect(source).toContain('secondaryStudentId');
    expect(source).toContain('Основной профиль должен быть аккаунтом платформы');
    expect(source).not.toMatch(/pickPrimary|choosePrimary|swapPrimary|preferSecondary/);
    expect(source).not.toMatch(/orderBy:.*createdAt|lesson_count|lessonCount/);
  });

  it('reassigns lesson student FK only (no schedule column updates in merge SQL)', () => {
    expect(source).toContain("'primary_student_id'");
    expect(source).toContain('assertLessonScheduleUnchanged');
    expect(source).toContain('assertRecurrenceScheduleUnchanged');
    expect(source).toContain('snapshotLessonSchedule');
    // Merge UPDATE helper only sets the FK column placeholder — not date/time.
    expect(source).toContain(
      'UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2',
    );
    expect(source).not.toMatch(
      /UPDATE\s+"lessons"\s+SET[^;]*(date|start_time|duration)/i,
    );
  });

  it('blocks secondary platform account so it cannot stay independent', () => {
    expect(source).toContain("status = 'blocked'");
    expect(source).toContain('secondary_user_blocked');
  });
});

describe('student-merge-schedule-guard', () => {
  it('keeps Saturday 14:00 equal after identical snapshot (regression fixture)', () => {
    const saturday = { id: 'l1', date: '2026-10-10', start_time: '14:00:00', duration: 60, recurrence_series_id: 's1' };
    expect(isSaturdayFourteenHundred(saturday)).toBe(true);
    expect(lessonScheduleRowsEqual([saturday], [{ ...saturday }])).toBe(true);
    expect(
      lessonScheduleRowsEqual(
        [saturday],
        [{ ...saturday, date: '2026-10-11', start_time: '14:30:00' }],
      ),
    ).toBe(false);
  });

  it('detects recurrence weekday/time mutation', () => {
    const before = [{
      id: 's1',
      weekday: 5,
      start_date: '2026-10-10',
      start_time: '14:00:00',
      duration: 60,
      until_date: null,
    }];
    expect(recurrenceScheduleRowsEqual(before, before)).toBe(true);
    expect(
      recurrenceScheduleRowsEqual(before, [{ ...before[0], weekday: 6, start_time: '14:30:00' }]),
    ).toBe(false);
  });
});

describe('User registry student profiles contract', () => {
  const source = readFileSync(join(__dirname, '../users/user-registry.service.ts'), 'utf8');

  it('includes students without platform accounts in registry queries', () => {
    expect(source).toContain('shouldIncludeStudentProfiles');
    expect(source).toContain('s.user_id IS NULL');
    expect(source).toContain('studentProfileToRegistryItem');
  });
});
