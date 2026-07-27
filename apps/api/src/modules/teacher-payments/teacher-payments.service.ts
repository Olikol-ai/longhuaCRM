import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { filterToEntityWhere } from '../../common/utils/api-record.util';
import { JwtPayload } from '../auth/auth.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherMonthlyPayoutEntity } from './entities/teacher-monthly-payout.entity';
import { TeacherPaymentEntity } from './entities/teacher-payment.entity';
import { UpdateTeacherPaymentDto } from './dto/update-teacher-payment.dto';
import { TeacherPaymentsRepository } from './teacher-payments.repository';
import { aggregateTeacherPaymentsByPeriod } from './teacher-pay-periods';

export type TeacherMonthlySummaryRow = {
  teacherId: string;
  teacherName: string;
  lessonsCount: number;
  totalMinutes: number;
  totalHours: number;
  amount: number;
  paymentStatus: 'unpaid' | 'paid';
  payoutId: string | null;
  paidAt: Date | null;
};

export type TeacherMonthlyLessonDetail = {
  lessonId: string;
  date: string;
  startTime: string;
  duration: number;
  amount: number;
};

@Injectable()
export class TeacherPaymentsService {
  constructor(
    private readonly repository: TeacherPaymentsRepository,
    private readonly teacherAccess: TeacherAccessService,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(TeacherMonthlyPayoutEntity)
    private readonly monthlyPayoutRepo: Repository<TeacherMonthlyPayoutEntity>,
  ) {}

  findAll(): Promise<TeacherPaymentEntity[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<TeacherPaymentEntity> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Teacher payment not found');
    }
    return row;
  }

  filter(where: Record<string, unknown>): Promise<TeacherPaymentEntity[]> {
    return this.repository.filter(
      filterToEntityWhere(where) as FindOptionsWhere<TeacherPaymentEntity>,
    );
  }

  async findMyPayments(actor: JwtPayload): Promise<TeacherPaymentEntity[]> {
    const teacherId = await this.teacherAccess.resolveTeacherId(actor);
    if (!teacherId) {
      return [];
    }
    return this.repository.filter({ teacherId } as FindOptionsWhere<TeacherPaymentEntity>);
  }

  /** Payroll periods (15th→14th) for the authenticated teacher — display totals. */
  async findMyPeriods(actor: JwtPayload) {
    const payments = await this.findMyPayments(actor);
    const lessonIds = [
      ...new Set(
        payments
          .map((p) => p.lessonId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const lessonDateById = new Map<string, string>();
    if (lessonIds.length > 0) {
      const lessons = await this.lessonRepo.find({
        where: { id: In(lessonIds) },
        select: ['id', 'date'],
      });
      for (const lesson of lessons) {
        lessonDateById.set(lesson.id, lesson.date);
      }
    }
    return aggregateTeacherPaymentsByPeriod(payments, lessonDateById);
  }

  async update(id: string, dto: UpdateTeacherPaymentDto): Promise<TeacherPaymentEntity> {
    const payload: Partial<TeacherPaymentEntity> = {
      status: dto.status,
    };
    if (dto.paidAt) {
      payload.paidAt = new Date(dto.paidAt);
    } else if (dto.status === 'paid') {
      payload.paidAt = new Date();
    }
    const row = await this.repository.update(id, payload);
    if (!row) {
      throw new NotFoundException('Teacher payment not found');
    }
    return row;
  }

  /**
   * Monthly salary summary from completed lessons (SSOT).
   * Per-lesson TeacherPayment rows stay as audit; payout status comes from
   * teacher_monthly_payouts (teacher_id + month).
   */
  async getMonthlySummary(month: string): Promise<TeacherMonthlySummaryRow[]> {
    this.assertMonthFormat(month);
    const { startDate, endDate } = this.monthBounds(month);

    const lessons = await this.lessonRepo.find({
      where: {
        status: 'completed',
        date: Between(startDate, endDate),
      },
      select: ['id', 'teacherId', 'date', 'duration', 'startTime'],
    });

    const teacherIds = [
      ...new Set(
        lessons
          .map((lesson) => lesson.teacherId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (teacherIds.length === 0) {
      return [];
    }

    const teachers = await this.teacherRepo.find({
      where: { id: In(teacherIds) },
      select: ['id', 'name', 'hourlyRate'],
    });
    const teacherById = new Map(teachers.map((t) => [t.id, t]));

    const payouts = await this.monthlyPayoutRepo.find({
      where: { month, teacherId: In(teacherIds) },
    });
    const payoutByTeacher = new Map(payouts.map((p) => [p.teacherId, p]));

    const byTeacher = new Map<
      string,
      { lessonsCount: number; totalMinutes: number; amount: number }
    >();

    for (const lesson of lessons) {
      if (!lesson.teacherId) continue;
      const teacher = teacherById.get(lesson.teacherId);
      if (!teacher) continue;

      const duration = Number(lesson.duration ?? 60);
      const hourlyRate = Number(teacher.hourlyRate ?? 0);
      const lessonAmount = Math.round(hourlyRate * (duration / 60) * 100) / 100;

      const current = byTeacher.get(lesson.teacherId) ?? {
        lessonsCount: 0,
        totalMinutes: 0,
        amount: 0,
      };
      current.lessonsCount += 1;
      current.totalMinutes += duration;
      current.amount = Math.round((current.amount + lessonAmount) * 100) / 100;
      byTeacher.set(lesson.teacherId, current);
    }

    const rows: TeacherMonthlySummaryRow[] = [];
    for (const [teacherId, stats] of byTeacher) {
      const teacher = teacherById.get(teacherId);
      if (!teacher) continue;
      const payout = payoutByTeacher.get(teacherId) ?? null;
      const totalHours = Math.round((stats.totalMinutes / 60) * 100) / 100;
      rows.push({
        teacherId,
        teacherName: teacher.name?.trim() || '',
        lessonsCount: stats.lessonsCount,
        totalMinutes: stats.totalMinutes,
        totalHours,
        amount: stats.amount,
        paymentStatus: payout?.status === 'paid' ? 'paid' : 'unpaid',
        payoutId: payout?.id ?? null,
        paidAt: payout?.paidAt ?? null,
      });
    }

    return rows.sort((a, b) =>
      a.teacherName.localeCompare(b.teacherName, 'ru', { sensitivity: 'base' }),
    );
  }

  async getMonthlyLessonDetails(
    month: string,
    teacherId: string,
  ): Promise<TeacherMonthlyLessonDetail[]> {
    this.assertMonthFormat(month);
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const { startDate, endDate } = this.monthBounds(month);
    const lessons = await this.lessonRepo.find({
      where: {
        teacherId,
        status: 'completed',
        date: Between(startDate, endDate),
      },
      select: ['id', 'date', 'startTime', 'duration'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    const hourlyRate = Number(teacher.hourlyRate ?? 0);
    return lessons.map((lesson) => {
      const duration = Number(lesson.duration ?? 60);
      return {
        lessonId: lesson.id,
        date: lesson.date,
        startTime: lesson.startTime,
        duration,
        amount: Math.round(hourlyRate * (duration / 60) * 100) / 100,
      };
    });
  }

  /**
   * Create a month-level payout (once per teacher + month).
   * Does not mutate per-lesson TeacherPayment audit rows.
   */
  async markMonthPaid(
    teacherId: string,
    month: string,
    amountOverride?: number,
  ): Promise<TeacherMonthlyPayoutEntity> {
    this.assertMonthFormat(month);

    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const existing = await this.monthlyPayoutRepo.findOne({
      where: { teacherId, month },
    });
    if (existing) {
      throw new ConflictException(
        'Выплата за этот месяц для преподавателя уже создана',
      );
    }

    const summary = await this.getMonthlySummary(month);
    const row = summary.find((item) => item.teacherId === teacherId);
    if (!row || row.lessonsCount === 0) {
      throw new BadRequestException(
        'Нет завершённых занятий для выплаты за этот месяц',
      );
    }

    const amount =
      amountOverride != null && Number.isFinite(amountOverride)
        ? Math.round(Number(amountOverride) * 100) / 100
        : row.amount;

    return this.monthlyPayoutRepo.save(
      this.monthlyPayoutRepo.create({
        teacherId,
        month,
        amount,
        status: 'paid',
        paidAt: new Date(),
      }),
    );
  }

  async createForCompletedLesson(
    lesson: LessonEntity,
    manager?: EntityManager,
  ): Promise<TeacherPaymentEntity | null> {
    const existing = manager
      ? await manager.getRepository(TeacherPaymentEntity).findOne({ where: { lessonId: lesson.id } })
      : await this.repository.findByLessonId(lesson.id);

    if (existing) {
      return existing;
    }

    if (!lesson.teacherId) {
      return null;
    }

    const resolvedTeacher = manager
      ? await manager.getRepository(TeacherEntity).findOne({ where: { id: lesson.teacherId } })
      : await this.teacherRepo.findOne({ where: { id: lesson.teacherId } });

    if (!resolvedTeacher) {
      return null;
    }

    const hourlyRate = Number(resolvedTeacher.hourlyRate ?? 0);
    const hours = (lesson.duration ?? 60) / 60;
    const amount = Math.round(hourlyRate * hours * 100) / 100;

    const payload = {
      teacherId: lesson.teacherId,
      lessonId: lesson.id,
      amount,
      status: 'pending' as const,
    };

    if (manager) {
      return this.repository.saveWithManager(manager, payload);
    }

    return this.repository.save(payload);
  }

  private assertMonthFormat(month: string): void {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be in yyyy-MM format');
    }
    const monthNum = Number(month.slice(5, 7));
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('month must be a valid calendar month');
    }
  }

  private monthBounds(month: string): { startDate: string; endDate: string } {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }
}
