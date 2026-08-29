import {
  addCalendarDaysYmd,
  getSchoolCalendarDateYmd,
} from '../telegram/telegram-messages';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService SSOT', () => {
  const teachers = {
    countActive: jest.fn(),
  };
  const students = {
    countActive: jest.fn(),
    countActiveWithLowBalance: jest.fn(),
    findActiveWithBirthday: jest.fn(),
  };
  const lessons = {
    listNonCancelledByDatesForAdmin: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'jobs.reminderTimezone' ? 'Europe/Minsk' : undefined,
    ),
  };

  const service = new AdminDashboardService(
    config as never,
    teachers as never,
    students as never,
    lessons as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    students.findActiveWithBirthday.mockResolvedValue([]);
  });

  it('returns SQL counts, not list.length of incomplete teacher rows', async () => {
    teachers.countActive.mockResolvedValue(2);
    students.countActive.mockResolvedValue(17);
    students.countActiveWithLowBalance.mockResolvedValue(3);
    lessons.listNonCancelledByDatesForAdmin.mockResolvedValue([
      { id: 'l1', date: '2099-01-01', status: 'planned' },
      { id: 'l2', date: '2099-01-02', status: 'planned' },
      { id: 'l3', date: '2099-01-01', status: 'planned' },
    ]);

    // Freeze calendar via mocked lesson dates matching service today/tomorrow
    const timezone = 'Europe/Minsk';
    const today = getSchoolCalendarDateYmd(timezone);
    const tomorrow = addCalendarDaysYmd(today, 1);
    lessons.listNonCancelledByDatesForAdmin.mockResolvedValue([
      { id: 'l1', date: today, status: 'planned' },
      { id: 'l2', date: tomorrow, status: 'planned' },
      { id: 'l3', date: today, status: 'planned' },
    ]);

    const summary = await service.getSummary({
      sub: 'admin',
      role: 'admin',
      email: 'a@t.com',
    } as never);

    expect(teachers.countActive).toHaveBeenCalled();
    expect(summary.counts.teachers).toBe(2);
    expect(summary.counts.students).toBe(17);
    expect(summary.counts.low_balance_students).toBe(3);
    expect(summary.counts.lessons_today).toBe(2);
    expect(summary.counts.lessons_tomorrow).toBe(1);
    expect(summary.lessons_today).toHaveLength(2);
    expect(summary.lessons_tomorrow).toHaveLength(1);
    expect(lessons.listNonCancelledByDatesForAdmin).toHaveBeenCalledWith(
      expect.anything(),
      [today, tomorrow],
    );
  });

  it('teacher KPI does not use teachers.filter(status!==inactive) semantics', async () => {
    // Simulate: 5 teacher rows not inactive, but only 2 canonical active users
    teachers.countActive.mockResolvedValue(2);
    students.countActive.mockResolvedValue(0);
    students.countActiveWithLowBalance.mockResolvedValue(0);
    lessons.listNonCancelledByDatesForAdmin.mockResolvedValue([]);

    const summary = await service.getSummary({
      sub: 'admin',
      role: 'admin',
      email: 'a@t.com',
    } as never);

    expect(summary.counts.teachers).toBe(2);
    expect(summary.counts.teachers).not.toBe(5);
  });
});
