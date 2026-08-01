import {
  getSchoolTimezoneNow,
  isLessonCreateTooSoon,
  LESSON_CREATE_MIN_LEAD_MS,
  parseLessonWallClock,
  shouldEnforceLessonCreateLeadTime,
} from './lesson-create-lead-time';

describe('lesson create lead time', () => {
  it('enforces for teacher and tutor only', () => {
    expect(shouldEnforceLessonCreateLeadTime('admin')).toBe(false);
    expect(shouldEnforceLessonCreateLeadTime('teacher')).toBe(true);
    expect(shouldEnforceLessonCreateLeadTime('tutor')).toBe(true);
    expect(shouldEnforceLessonCreateLeadTime('student')).toBe(false);
    expect(shouldEnforceLessonCreateLeadTime(null)).toBe(false);
  });

  it('blocks when start is less than 2 hours ahead', () => {
    const now = parseLessonWallClock('2026-08-01', '12:00');
    expect(isLessonCreateTooSoon('2026-08-01', '13:30', now)).toBe(true);
    expect(isLessonCreateTooSoon('2026-08-01', '12:30', now)).toBe(true);
    expect(isLessonCreateTooSoon('2026-08-01', '14:00', now)).toBe(false);
    expect(isLessonCreateTooSoon('2026-08-01', '15:00', now)).toBe(false);
  });

  it('uses exact 2-hour threshold (strictly less than)', () => {
    const now = parseLessonWallClock('2026-08-01', '12:00');
    const exactlyTwoHours = new Date(now.getTime() + LESSON_CREATE_MIN_LEAD_MS);
    const hh = String(exactlyTwoHours.getHours()).padStart(2, '0');
    const mm = String(exactlyTwoHours.getMinutes()).padStart(2, '0');
    expect(isLessonCreateTooSoon('2026-08-01', `${hh}:${mm}`, now)).toBe(false);
    expect(
      isLessonCreateTooSoon(
        '2026-08-01',
        `${hh}:${mm}`,
        now,
        LESSON_CREATE_MIN_LEAD_MS + 1,
      ),
    ).toBe(true);
  });

  it('getSchoolTimezoneNow returns a Date', () => {
    expect(getSchoolTimezoneNow()).toBeInstanceOf(Date);
  });
});
