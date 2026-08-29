import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth/auth.service';
import { LessonsService } from '../lessons/lessons.service';
import { StudentsRepository } from '../students/students.repository';
import { TeachersService } from '../teachers/teachers.service';
import {
  addCalendarDaysYmd,
  getSchoolCalendarDateYmd,
} from '../telegram/telegram-messages';

export type AdminDashboardBirthday = {
  id: string;
  name: string;
  birthday: string;
  daysUntil: number;
  birthdayDate: string;
};

/**
 * Canonical Admin Dashboard payload.
 * All KPI counts are SQL COUNT / filtered day queries — never client-side list.length.
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly config: ConfigService,
    private readonly teachers: TeachersService,
    private readonly students: StudentsRepository,
    private readonly lessons: LessonsService,
  ) {}

  private schoolTimezone(): string {
    return this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
  }

  async getSummary(actor: JwtPayload) {
    const timezone = this.schoolTimezone();
    const today = getSchoolCalendarDateYmd(timezone);
    const tomorrow = addCalendarDaysYmd(today, 1);

    const [
      teachersCount,
      studentsCount,
      lowBalanceCount,
      dayLessons,
      upcomingBirthdays,
    ] = await Promise.all([
      this.teachers.countActive(),
      this.students.countActive(),
      this.students.countActiveWithLowBalance(),
      this.lessons.listNonCancelledByDatesForAdmin(actor, [today, tomorrow]),
      this.buildUpcomingBirthdays(today),
    ]);

    const lessonsToday = dayLessons.filter((row) => this.lessonDateYmd(row.date) === today);
    const lessonsTomorrow = dayLessons.filter(
      (row) => this.lessonDateYmd(row.date) === tomorrow,
    );

    return {
      timezone,
      today,
      tomorrow,
      counts: {
        teachers: teachersCount,
        students: studentsCount,
        lessons_today: lessonsToday.length,
        lessons_tomorrow: lessonsTomorrow.length,
        low_balance_students: lowBalanceCount,
      },
      lessons_today: lessonsToday,
      lessons_tomorrow: lessonsTomorrow,
      upcoming_birthdays: upcomingBirthdays,
    };
  }

  private lessonDateYmd(value: string | Date): string {
    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(value ?? '').slice(0, 10);
  }

  private async buildUpcomingBirthdays(
    todayYmd: string,
  ): Promise<AdminDashboardBirthday[]> {
    const students = await this.students.findActiveWithBirthday();
    const [ty, tm, td] = todayYmd.split('-').map(Number);
    const todayUtc = Date.UTC(ty, tm - 1, td);

    const rows: AdminDashboardBirthday[] = [];
    for (const student of students) {
      const birthday = String(student.birthday ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) continue;
      const [, bm, bd] = birthday.split('-').map(Number);
      let target = Date.UTC(ty, bm - 1, bd);
      if (target < todayUtc) {
        target = Date.UTC(ty + 1, bm - 1, bd);
      }
      const daysUntil = Math.round((target - todayUtc) / (24 * 60 * 60 * 1000));
      if (daysUntil < 0 || daysUntil > 30) continue;
      const yy = new Date(target).getUTCFullYear();
      const mm = String(new Date(target).getUTCMonth() + 1).padStart(2, '0');
      const dd = String(new Date(target).getUTCDate()).padStart(2, '0');
      rows.push({
        id: student.id,
        name: student.name || [student.lastName, student.firstName].filter(Boolean).join(' ') || 'Ученик',
        birthday,
        daysUntil,
        birthdayDate: `${yy}-${mm}-${dd}`,
      });
    }
    return rows.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, 'ru'));
  }
}
