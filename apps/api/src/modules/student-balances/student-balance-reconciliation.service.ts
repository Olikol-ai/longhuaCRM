import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { StudentLessonBalanceAdjustmentEntity } from './entities/student-lesson-balance-adjustment.entity';
import { StudentBalanceLedgerEntity } from './entities/student-balance-ledger.entity';
import { StudentBalanceLedgerService } from './student-balance-ledger.service';

export type StudentBalanceAuditReport = {
  studentId: string;
  studentName: string;
  currentBalance: number;
  ledgerDerivedBalance: number;
  /** current − ledger sum; non-zero means pre-ledger / unlogged history */
  unreconciledLegacyDelta: number;
  status: 'RECONCILED' | 'HISTORICAL_DISCREPANCY';
  breakdown: {
    credits: number;
    debits: number;
    restores: number;
    adjustments: number;
    initials: number;
    mergeIn: number;
    mergeOut: number;
    legacyReconciliation: number;
    paymentsPurchased: number;
    legacyAdjustmentsSum: number;
  };
  ledgerEntries: Array<{
    id: string;
    delta: number;
    balanceBefore: number;
    balanceAfter: number;
    operationType: string;
    sourceType: string;
    sourceId: string | null;
    idempotencyKey: string;
    description: string | null;
    createdAt: string;
  }>;
  note: string;
};

/**
 * Diagnostic-only reconciliation. Never mutates balances.
 */
@Injectable()
export class StudentBalanceReconciliationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: StudentBalanceLedgerService,
  ) {}

  async auditStudent(studentId: string): Promise<StudentBalanceAuditReport> {
    const student = await this.dataSource.getRepository(StudentEntity).findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const entries = await this.ledger.listForStudent(studentId, 1000);
    const ledgerSum = entries.reduce((acc, row) => acc + row.delta, 0);
    const currentBalance = student.lessonBalance ?? 0;
    const unreconciledLegacyDelta = currentBalance - ledgerSum;

    const breakdown = {
      credits: 0,
      debits: 0,
      restores: 0,
      adjustments: 0,
      initials: 0,
      mergeIn: 0,
      mergeOut: 0,
      legacyReconciliation: 0,
      paymentsPurchased: 0,
      legacyAdjustmentsSum: 0,
    };

    for (const row of entries) {
      switch (row.operationType) {
        case 'credit':
          breakdown.credits += row.delta;
          break;
        case 'debit':
          breakdown.debits += row.delta;
          break;
        case 'restore':
          breakdown.restores += row.delta;
          break;
        case 'adjustment':
          breakdown.adjustments += row.delta;
          break;
        case 'initial':
          breakdown.initials += row.delta;
          break;
        case 'merge_in':
          breakdown.mergeIn += row.delta;
          break;
        case 'merge_out':
          breakdown.mergeOut += row.delta;
          break;
        case 'legacy_reconciliation':
          breakdown.legacyReconciliation += row.delta;
          break;
        default:
          break;
      }
    }

    const payRaw = await this.dataSource
      .getRepository(PaymentEntity)
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.lessons_added), 0)', 'sum')
      .where('p.student_id = :studentId', { studentId })
      .andWhere("p.status = 'paid'")
      .getRawOne<{ sum: string }>();
    breakdown.paymentsPurchased = Math.trunc(Number(payRaw?.sum) || 0);

    const adjRaw = await this.dataSource
      .getRepository(StudentLessonBalanceAdjustmentEntity)
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.change_amount), 0)', 'sum')
      .where('a.student_id = :studentId', { studentId })
      .getRawOne<{ sum: string }>();
    breakdown.legacyAdjustmentsSum = Math.trunc(Number(adjRaw?.sum) || 0);

    const status =
      unreconciledLegacyDelta === 0 ? 'RECONCILED' : 'HISTORICAL_DISCREPANCY';

    return {
      studentId,
      studentName: student.name,
      currentBalance,
      ledgerDerivedBalance: ledgerSum,
      unreconciledLegacyDelta,
      status,
      breakdown,
      ledgerEntries: entries.map((e) => ({
        id: e.id,
        delta: e.delta,
        balanceBefore: e.balanceBefore,
        balanceAfter: e.balanceAfter,
        operationType: e.operationType,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        idempotencyKey: e.idempotencyKey,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
      note:
        status === 'RECONCILED'
          ? ledgerSum === 0 && currentBalance === 0 && entries.length === 0
            ? 'Empty history and zero balance — reconciled.'
            : 'Current balance matches ledger sum.'
          : 'Legacy/unlogged mutations exist before ledger cutover. Do not auto-rewrite; mark for manual review if needed.',
    };
  }

  async summarizeAll(limit = 500): Promise<{
    scanned: number;
    reconciled: number;
    historicalDiscrepancy: number;
    samples: Array<{
      studentId: string;
      name: string;
      currentBalance: number;
      ledgerDerivedBalance: number;
      unreconciledLegacyDelta: number;
      status: string;
    }>;
  }> {
    const students = await this.dataSource.getRepository(StudentEntity).find({
      where: {},
      select: ['id', 'name', 'lessonBalance'],
      take: Math.min(Math.max(limit, 1), 5000),
      order: { name: 'ASC' },
    });

    const ledgerSums = await this.dataSource
      .getRepository(StudentBalanceLedgerEntity)
      .createQueryBuilder('l')
      .select('l.student_id', 'student_id')
      .addSelect('COALESCE(SUM(l.delta), 0)', 'sum')
      .groupBy('l.student_id')
      .getRawMany<{ student_id: string; sum: string }>();

    const sumByStudent = new Map(
      ledgerSums.map((r) => [r.student_id, Math.trunc(Number(r.sum) || 0)]),
    );

    let reconciled = 0;
    let historicalDiscrepancy = 0;
    const samples: Array<{
      studentId: string;
      name: string;
      currentBalance: number;
      ledgerDerivedBalance: number;
      unreconciledLegacyDelta: number;
      status: string;
    }> = [];

    for (const s of students) {
      const current = s.lessonBalance ?? 0;
      const ledger = sumByStudent.get(s.id) ?? 0;
      const delta = current - ledger;
      const status = delta === 0 ? 'RECONCILED' : 'HISTORICAL_DISCREPANCY';
      if (status === 'RECONCILED') {
        reconciled += 1;
      } else {
        historicalDiscrepancy += 1;
        if (samples.length < 50) {
          samples.push({
            studentId: s.id,
            name: s.name,
            currentBalance: current,
            ledgerDerivedBalance: ledger,
            unreconciledLegacyDelta: delta,
            status,
          });
        }
      }
    }

    return {
      scanned: students.length,
      reconciled,
      historicalDiscrepancy,
      samples,
    };
  }
}
