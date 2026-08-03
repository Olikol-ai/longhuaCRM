import { LessonRecurrenceService } from './lesson-recurrence.service';

/** Exercise pure date helpers via a lightweight stub (no Nest DI). */
function makeHelpers() {
  const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
  return {
    weekdayFromDate: (d: string) => svc.weekdayFromDate(d),
    addDays: (d: string, n: number) =>
      (svc as unknown as { addDays(dateStr: string, days: number): string }).addDays(d, n),
    firstWeekdayOnOrAfter: (d: string, wd: number) =>
      (
        svc as unknown as {
          firstWeekdayOnOrAfter(dateStr: string, weekday: number): string;
        }
      ).firstWeekdayOnOrAfter(d, wd),
  };
}

describe('LessonRecurrenceService date helpers', () => {
  const h = makeHelpers();

  it('weekdayFromDate uses Mon=0 … Sun=6 in UTC calendar dates', () => {
    // 2026-08-03 is Monday
    expect(h.weekdayFromDate('2026-08-03')).toBe(0);
    // 2026-08-09 is Sunday
    expect(h.weekdayFromDate('2026-08-09')).toBe(6);
  });

  it('addDays keeps ISO calendar arithmetic across month boundary', () => {
    expect(h.addDays('2026-08-29', 7)).toBe('2026-09-05');
    expect(h.addDays('2026-08-01', 7)).toBe('2026-08-08');
  });

  it('firstWeekdayOnOrAfter finds next matching weekday', () => {
    expect(h.firstWeekdayOnOrAfter('2026-08-03', 0)).toBe('2026-08-03');
    expect(h.firstWeekdayOnOrAfter('2026-08-04', 0)).toBe('2026-08-10');
  });
});
