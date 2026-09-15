import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { JwtPayload } from '../auth/auth.service';
import { AdminBalancesQueryDto } from './dto/admin-balances-query.dto';
import { AdjustStudentLessonBalanceDto } from './dto/adjust-student-lesson-balance.dto';
import { StudentLessonBalanceAdjustmentEntity } from './entities/student-lesson-balance-adjustment.entity';
import {
  BALANCE_DEDUCT_LESSON_STATUSES,
  computeMoneyPosition,
  roundMoney,
} from './student-balance-math';

export type AdminBalanceRow = {
  student_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  assigned_teacher_id: string | null;
  assigned_teacher_name: string | null;
  lesson_balance: number;
  /** Implied CRM-import credit: balance + conducted − purchased */
  historical_lessons_credit: number;
  conducted_lessons: number;
  planned_lessons: number;
  cancelled_lessons: number;
  upcoming_lessons: number;
  individual_conducted: number;
  group_conducted: number;
  paid_amount: number;
  lessons_purchased: number;
  unit_price: number | null;
  cost_conducted: number | null;
  money_position: number | null;
  debt_amount: number;
  overpayment_amount: number;
};

export type AdminBalancesSummary = {
  students_total: number;
  debtors_count: number;
  total_debt: number;
  total_overpayment: number;
  conducted_lessons_total: number;
};

export type AdminBalancesListResult = {
  items: AdminBalanceRow[];
  total: number;
  page: number;
  limit: number;
  page_count: number;
  summary: AdminBalancesSummary;
};

export type AdminBalanceHistoryItem = {
  id: string;
  date: string;
  type: 'payment' | 'lesson' | 'adjustment';
  label: string;
  amount: number | null;
  comment: string | null;
  lesson_id: string | null;
  payment_id: string | null;
  status: string | null;
};

export type AdminBalanceDetail = {
  student: AdminBalanceRow;
  finance: {
    paid_amount: number;
    cost_conducted: number | null;
    debt_amount: number;
    overpayment_amount: number;
    money_position: number | null;
    unit_price: number | null;
    lesson_balance: number;
    lessons_purchased: number;
    historical_lessons_credit: number;
  };
  lessons: {
    conducted: number;
    planned: number;
    cancelled: number;
    upcoming: number;
    individual_conducted: number;
    group_conducted: number;
  };
  history: AdminBalanceHistoryItem[];
};

type AggRow = {
  student_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  assigned_teacher_id: string | null;
  assigned_teacher_name: string | null;
  lesson_balance: number;
  paid_amount: string | number;
  paid_for_lessons: string | number;
  lessons_purchased: string | number;
  conducted_lessons: string | number;
  planned_lessons: string | number;
  cancelled_lessons: string | number;
  upcoming_lessons: string | number;
  individual_conducted: string | number;
  group_conducted: string | number;
};

@Injectable()
export class StudentBalancesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(query: AdminBalancesQueryDto = {}): Promise<AdminBalancesListResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 25));
    const rows = await this.loadAggregatedRows(query);
    const enriched = rows.map((row) => this.toBalanceRow(row));
    const filtered = this.applyMoneyFilters(enriched, query);
    this.sortRows(filtered, query.sort ?? 'name', query.sortDir ?? 'asc');

    const summary = this.buildSummary(filtered);
    const total = filtered.length;
    const pageCount = total === 0 ? 0 : Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      total,
      page,
      limit,
      page_count: pageCount,
      summary,
    };
  }

  async detail(studentId: string): Promise<AdminBalanceDetail> {
    const rows = await this.loadAggregatedRows({ search: undefined }, studentId);
    if (rows.length === 0) {
      throw new NotFoundException('Student not found');
    }
    const student = this.toBalanceRow(rows[0]);
    const history = await this.loadHistory(studentId, student.unit_price);

    return {
      student,
      finance: {
        paid_amount: student.paid_amount,
        cost_conducted: student.cost_conducted,
        debt_amount: student.debt_amount,
        overpayment_amount: student.overpayment_amount,
        money_position: student.money_position,
        unit_price: student.unit_price,
        lesson_balance: student.lesson_balance,
        lessons_purchased: student.lessons_purchased,
        historical_lessons_credit: student.historical_lessons_credit,
      },
      lessons: {
        conducted: student.conducted_lessons,
        planned: student.planned_lessons,
        cancelled: student.cancelled_lessons,
        upcoming: student.upcoming_lessons,
        individual_conducted: student.individual_conducted,
        group_conducted: student.group_conducted,
      },
      history,
    };
  }

  /**
   * Set students.lesson_balance to an absolute target with audit trail.
   * Does not create fake payments or lessons.
   */
  async adjustLessonBalance(
    actor: JwtPayload,
    studentId: string,
    dto: AdjustStudentLessonBalanceDto,
  ): Promise<AdminBalanceDetail> {
    const newBalance = Number(dto.newBalance);
    if (!Number.isInteger(newBalance)) {
      throw new BadRequestException(
        'Остаток занятий должен быть целым числом (допускается отрицательный — долг)',
      );
    }
    // Reason is optional in the Balance UI; column remains NOT NULL → store ''.
    const reason = String(dto.reason ?? '').trim();

    await this.dataSource.transaction(async (manager) => {
      const studentRepo = manager.getRepository(StudentEntity);
      const student = await studentRepo.findOne({
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student || student.mergedIntoStudentId) {
        throw new NotFoundException('Student not found');
      }

      const oldBalance = student.lessonBalance ?? 0;
      if (oldBalance === newBalance) {
        return;
      }

      student.lessonBalance = newBalance;
      await studentRepo.save(student);

      await manager.getRepository(StudentLessonBalanceAdjustmentEntity).save(
        manager.getRepository(StudentLessonBalanceAdjustmentEntity).create({
          studentId,
          oldBalance,
          newBalance,
          changeAmount: newBalance - oldBalance,
          reason,
          createdBy: actor.sub ?? null,
        }),
      );

      await manager.getRepository(AuditLogEntity).save(
        manager.getRepository(AuditLogEntity).create({
          actorUserId: actor.sub ?? null,
          action: 'lesson_balance_adjustment',
          entityType: 'Student',
          entityId: studentId,
          summary: reason
            ? `historical/manual adjustment: balance ${oldBalance} → ${newBalance} (${reason})`
            : `historical/manual adjustment: balance ${oldBalance} → ${newBalance}`,
        }),
      );
    });

    return this.detail(studentId);
  }

  private toBalanceRow(row: AggRow): AdminBalanceRow {
    const lessonBalance = Math.trunc(Number(row.lesson_balance) || 0);
    const money = computeMoneyPosition({
      paidAmount: Number(row.paid_amount) || 0,
      paidAmountForLessons: Number(row.paid_for_lessons) || 0,
      lessonsPurchased: Number(row.lessons_purchased) || 0,
      conductedLessons: Number(row.conducted_lessons) || 0,
      lessonBalance,
    });
    return {
      student_id: row.student_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      assigned_teacher_id: row.assigned_teacher_id,
      assigned_teacher_name: row.assigned_teacher_name,
      lesson_balance: money.lessonBalance,
      historical_lessons_credit: money.historicalLessonsCredit,
      conducted_lessons: money.conductedLessons,
      planned_lessons: Math.trunc(Number(row.planned_lessons) || 0),
      cancelled_lessons: Math.trunc(Number(row.cancelled_lessons) || 0),
      upcoming_lessons: Math.trunc(Number(row.upcoming_lessons) || 0),
      individual_conducted: Math.trunc(Number(row.individual_conducted) || 0),
      group_conducted: Math.trunc(Number(row.group_conducted) || 0),
      paid_amount: money.paidAmount,
      lessons_purchased: money.lessonsPurchased,
      unit_price: money.unitPrice,
      cost_conducted: money.costConducted,
      money_position: money.moneyPosition,
      debt_amount: money.debtAmount,
      overpayment_amount: money.overpaymentAmount,
    };
  }

  private applyMoneyFilters(
    rows: AdminBalanceRow[],
    query: AdminBalancesQueryDto,
  ): AdminBalanceRow[] {
    let out = rows;
    if (query.debtorsOnly) {
      out = out.filter((row) => row.debt_amount > 0 || row.lesson_balance < 0);
    }
    if (query.positiveBalanceOnly) {
      out = out.filter((row) => row.overpayment_amount > 0 || row.lesson_balance > 0);
    }
    return out;
  }

  private sortRows(
    rows: AdminBalanceRow[],
    sort: NonNullable<AdminBalancesQueryDto['sort']>,
    sortDir: 'asc' | 'desc',
  ): void {
    const dir = sortDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort) {
        case 'debt':
          cmp = a.debt_amount - b.debt_amount;
          break;
        case 'overpayment':
          cmp = a.overpayment_amount - b.overpayment_amount;
          break;
        case 'conducted':
          cmp = a.conducted_lessons - b.conducted_lessons;
          break;
        case 'lesson_balance':
          cmp = a.lesson_balance - b.lesson_balance;
          break;
        case 'paid':
          cmp = a.paid_amount - b.paid_amount;
          break;
        case 'name':
        default:
          cmp = a.name.localeCompare(b.name, 'ru');
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  private buildSummary(rows: AdminBalanceRow[]): AdminBalancesSummary {
    let debtors = 0;
    let totalDebt = 0;
    let totalOverpayment = 0;
    let conducted = 0;
    for (const row of rows) {
      if (row.debt_amount > 0 || row.lesson_balance < 0) debtors += 1;
      totalDebt = roundMoney(totalDebt + row.debt_amount);
      totalOverpayment = roundMoney(totalOverpayment + row.overpayment_amount);
      conducted += row.conducted_lessons;
    }
    return {
      students_total: rows.length,
      debtors_count: debtors,
      total_debt: totalDebt,
      total_overpayment: totalOverpayment,
      conducted_lessons_total: conducted,
    };
  }

  /**
   * Single aggregated query: students + payments + lesson counts.
   * Conducted lessons follow StudentBalanceService participant rules and
   * BALANCE_DEDUCT_LESSON_STATUSES (completed | missed_no_notice).
   */
  private async loadAggregatedRows(
    query: AdminBalancesQueryDto,
    onlyStudentId?: string,
  ): Promise<AggRow[]> {
    const deductStatuses = [...BALANCE_DEDUCT_LESSON_STATUSES];
    const params: unknown[] = [deductStatuses];
    let paramIndex = 2;

    const where: string[] = [
      's.merged_into_student_id IS NULL',
      "s.status != 'inactive'",
    ];

    if (onlyStudentId) {
      where.push(`s.id = $${paramIndex}`);
      params.push(onlyStudentId);
      paramIndex += 1;
    }

    if (query.search?.trim()) {
      const pattern = `%${query.search.trim().replace(/[%_\\]/g, '\\$&')}%`;
      where.push(
        `(s.name ILIKE $${paramIndex} OR COALESCE(s.email, '') ILIKE $${paramIndex} OR COALESCE(s.phone, '') ILIKE $${paramIndex})`,
      );
      params.push(pattern);
      paramIndex += 1;
    }

    if (query.teacherId) {
      where.push(`s.assigned_teacher_id = $${paramIndex}`);
      params.push(query.teacherId);
      paramIndex += 1;
    }

    if (query.groupId) {
      where.push(
        `EXISTS (SELECT 1 FROM group_members gm_f WHERE gm_f.student_id = s.id AND gm_f.group_id = $${paramIndex})`,
      );
      params.push(query.groupId);
      paramIndex += 1;
    }

    const sql = `
      WITH lesson_links AS (
        SELECT
          l.id AS lesson_id,
          l.status,
          l.date AS lesson_date,
          CASE
            WHEN l.lesson_type = 'individual' AND l.group_id IS NULL AND l.primary_student_id IS NOT NULL
              THEN l.primary_student_id
            ELSE NULL
          END AS individual_student_id,
          CASE
            WHEN l.group_id IS NOT NULL THEN l.group_id
            ELSE NULL
          END AS group_id
        FROM lessons l
      ),
      student_lessons AS (
        SELECT
          ll.individual_student_id AS student_id,
          ll.lesson_id,
          ll.status,
          ll.lesson_date,
          'individual'::text AS kind
        FROM lesson_links ll
        WHERE ll.individual_student_id IS NOT NULL

        UNION ALL

        SELECT
          gm.student_id,
          ll.lesson_id,
          ll.status,
          ll.lesson_date,
          'group'::text AS kind
        FROM lesson_links ll
        INNER JOIN group_members gm ON gm.group_id = ll.group_id
        WHERE ll.group_id IS NOT NULL
      ),
      lesson_stats AS (
        SELECT
          sl.student_id,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = ANY($1::text[])
          )::int AS conducted_lessons,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = 'planned'
          )::int AS planned_lessons,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = 'cancelled'
          )::int AS cancelled_lessons,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = 'planned' AND sl.lesson_date >= CURRENT_DATE
          )::int AS upcoming_lessons,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = ANY($1::text[]) AND sl.kind = 'individual'
          )::int AS individual_conducted,
          COUNT(DISTINCT sl.lesson_id) FILTER (
            WHERE sl.status = ANY($1::text[]) AND sl.kind = 'group'
          )::int AS group_conducted
        FROM student_lessons sl
        GROUP BY sl.student_id
      ),
      payment_stats AS (
        SELECT
          p.student_id,
          COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS paid_amount,
          COALESCE(SUM(p.amount) FILTER (
            WHERE p.status = 'paid' AND COALESCE(p.lessons_added, 0) > 0
          ), 0) AS paid_for_lessons,
          COALESCE(SUM(p.lessons_added) FILTER (
            WHERE p.status = 'paid' AND COALESCE(p.lessons_added, 0) > 0
          ), 0)::int AS lessons_purchased
        FROM payments p
        WHERE p.student_id IS NOT NULL
        GROUP BY p.student_id
      )
      SELECT
        s.id AS student_id,
        s.name,
        s.email,
        s.phone,
        s.status,
        s.assigned_teacher_id,
        t.name AS assigned_teacher_name,
        s.lesson_balance,
        COALESCE(ps.paid_amount, 0) AS paid_amount,
        COALESCE(ps.paid_for_lessons, 0) AS paid_for_lessons,
        COALESCE(ps.lessons_purchased, 0) AS lessons_purchased,
        COALESCE(ls.conducted_lessons, 0) AS conducted_lessons,
        COALESCE(ls.planned_lessons, 0) AS planned_lessons,
        COALESCE(ls.cancelled_lessons, 0) AS cancelled_lessons,
        COALESCE(ls.upcoming_lessons, 0) AS upcoming_lessons,
        COALESCE(ls.individual_conducted, 0) AS individual_conducted,
        COALESCE(ls.group_conducted, 0) AS group_conducted
      FROM students s
      LEFT JOIN teachers t ON t.id = s.assigned_teacher_id
      LEFT JOIN payment_stats ps ON ps.student_id = s.id
      LEFT JOIN lesson_stats ls ON ls.student_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY s.name ASC
    `;

    return this.dataSource.query(sql, params);
  }

  private async loadHistory(
    studentId: string,
    unitPrice: number | null,
  ): Promise<AdminBalanceHistoryItem[]> {
    const payments: Array<{
      id: string;
      amount: string | number;
      status: string;
      payment_date: string | null;
      paid_at: Date | string | null;
      notes: string | null;
      lessons_added: number;
      created_at: Date | string;
    }> = await this.dataSource.query(
      `
      SELECT id, amount, status, payment_date, paid_at, notes, lessons_added, created_at
      FROM payments
      WHERE student_id = $1
      ORDER BY COALESCE(paid_at, payment_date::timestamptz, created_at) DESC
      `,
      [studentId],
    );

    const lessons: Array<{
      lesson_id: string;
      status: string;
      lesson_date: string;
      start_time: string | null;
      lesson_type: string | null;
      kind: string;
    }> = await this.dataSource.query(
      `
      WITH lesson_links AS (
        SELECT
          l.id AS lesson_id,
          l.status,
          l.date AS lesson_date,
          l.start_time,
          l.lesson_type,
          CASE
            WHEN l.lesson_type = 'individual' AND l.group_id IS NULL AND l.primary_student_id IS NOT NULL
              THEN l.primary_student_id
            ELSE NULL
          END AS individual_student_id,
          l.group_id
        FROM lessons l
        WHERE l.status = ANY($2::text[])
      )
      SELECT
        ll.lesson_id,
        ll.status,
        ll.lesson_date,
        ll.start_time::text AS start_time,
        ll.lesson_type,
        'individual'::text AS kind
      FROM lesson_links ll
      WHERE ll.individual_student_id = $1

      UNION ALL

      SELECT
        ll.lesson_id,
        ll.status,
        ll.lesson_date,
        ll.start_time::text AS start_time,
        ll.lesson_type,
        'group'::text AS kind
      FROM lesson_links ll
      INNER JOIN group_members gm ON gm.group_id = ll.group_id
      WHERE gm.student_id = $1 AND ll.group_id IS NOT NULL
      `,
      [studentId, [...BALANCE_DEDUCT_LESSON_STATUSES]],
    );

    const history: AdminBalanceHistoryItem[] = [];

    for (const payment of payments) {
      const date =
        (payment.paid_at
          ? new Date(payment.paid_at).toISOString().slice(0, 10)
          : null)
        || payment.payment_date
        || (payment.created_at
          ? new Date(payment.created_at).toISOString().slice(0, 10)
          : '');
      const lessonsNote =
        Number(payment.lessons_added) > 0
          ? ` (+${payment.lessons_added} зан.)`
          : '';
      history.push({
        id: `payment:${payment.id}`,
        date,
        type: 'payment',
        label: payment.status === 'paid' ? 'Оплата' : `Платёж (${payment.status})`,
        amount: payment.status === 'paid' ? roundMoney(Number(payment.amount) || 0) : null,
        comment: `${payment.notes?.trim() || 'Оплата'}${lessonsNote}`,
        lesson_id: null,
        payment_id: payment.id,
        status: payment.status,
      });
    }

    for (const lesson of lessons) {
      const time = lesson.start_time ? String(lesson.start_time).slice(0, 5) : '';
      const kindLabel = lesson.kind === 'group' ? 'групповое' : 'индивидуальное';
      history.push({
        id: `lesson:${lesson.lesson_id}`,
        date: String(lesson.lesson_date).slice(0, 10),
        type: 'lesson',
        label: 'Занятие',
        amount: unitPrice != null ? roundMoney(-unitPrice) : null,
        comment: `${kindLabel}${time ? `, ${time}` : ''} · ${lesson.status}`,
        lesson_id: lesson.lesson_id,
        payment_id: null,
        status: lesson.status,
      });
    }

    const adjustments: Array<{
      id: string;
      old_balance: number;
      new_balance: number;
      change_amount: number;
      reason: string;
      created_at: Date | string;
    }> = await this.dataSource.query(
      `
      SELECT id, old_balance, new_balance, change_amount, reason, created_at
      FROM student_lesson_balance_adjustments
      WHERE student_id = $1
      ORDER BY created_at DESC
      `,
      [studentId],
    ).catch(() => []);

    for (const adj of adjustments) {
      history.push({
        id: `adjustment:${adj.id}`,
        date: new Date(adj.created_at).toISOString().slice(0, 10),
        type: 'adjustment',
        label: 'Корректировка остатка',
        amount: null,
        comment:
          `${adj.reason} · занятия ${adj.old_balance} → ${adj.new_balance}`
          + ` (${adj.change_amount >= 0 ? '+' : ''}${adj.change_amount})`,
        lesson_id: null,
        payment_id: null,
        status: 'adjustment',
      });
    }

    history.sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      if (byDate !== 0) return byDate;
      return a.type.localeCompare(b.type);
    });

    return history;
  }
}
