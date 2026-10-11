import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StudentEntity } from '../students/entities/student.entity';
import {
  StudentBalanceOperationType,
  StudentBalanceSourceType,
} from './entities/student-balance-ledger.entity';
import { StudentBalanceLedgerService } from './student-balance-ledger.service';

type PlannedOp = {
  studentId: string;
  delta: number;
  operationType: StudentBalanceOperationType;
  sourceType: StudentBalanceSourceType;
  sourceId: string | null;
  idempotencyKey: string;
  description: string;
  createdAt: Date;
  createdByUserId: string | null;
  /** If true, apply() mutates students.lesson_balance (orphan restore corrections). */
  mutatesBalance: boolean;
};

export type LegacyImportStudentResult = {
  studentId: string;
  name: string;
  balanceBefore: number;
  balanceAfter: number;
  balanceChanged: boolean;
  importedDocs: number;
  appliedMutations: number;
  legacyReconciliationDelta: number;
  ledgerSum: number;
  reconciled: boolean;
};

export type LegacyImportReport = {
  studentsProcessed: number;
  studentsCorrected: number;
  studentsUnchanged: number;
  lowConfidenceAdjustments: number;
  results: LegacyImportStudentResult[];
  allReconciled: boolean;
};

/**
 * One-shot (idempotent) import of recoverable legacy balance history into
 * student_balance_ledger, plus orphan-delete restores and LEGACY_RECONCILIATION
 * for any remaining unexplained gap vs current counter.
 */
@Injectable()
export class StudentBalanceLegacyMigrationService {
  private readonly logger = new Logger(StudentBalanceLegacyMigrationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: StudentBalanceLedgerService,
  ) {}

  async importAll(options?: { dryRun?: boolean }): Promise<LegacyImportReport> {
    const dryRun = Boolean(options?.dryRun);
    const students = await this.dataSource.getRepository(StudentEntity).find({
      where: {},
      order: { name: 'ASC' },
    });
    const active = students.filter((s) => !s.mergedIntoStudentId);

    const results: LegacyImportStudentResult[] = [];
    for (const student of active) {
      const result = await this.importStudent(student.id, { dryRun });
      results.push(result);
    }

    const studentsCorrected = results.filter((r) => r.balanceChanged).length;
    const lowConfidenceAdjustments = results.filter(
      (r) => r.legacyReconciliationDelta !== 0,
    ).length;

    return {
      studentsProcessed: results.length,
      studentsCorrected,
      studentsUnchanged: results.length - studentsCorrected,
      lowConfidenceAdjustments,
      results,
      allReconciled: results.every((r) => r.reconciled),
    };
  }

  async importStudent(
    studentId: string,
    options?: { dryRun?: boolean },
  ): Promise<LegacyImportStudentResult> {
    const dryRun = Boolean(options?.dryRun);

    return this.dataSource.transaction(async (manager) => {
      const student = await manager.getRepository(StudentEntity).findOne({
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        throw new Error(`Student not found: ${studentId}`);
      }

      const balanceBefore = student.lessonBalance ?? 0;
      const planned = await this.buildPlan(student, manager);

      // Sort: docs first by date, mutations (orphan restores) after docs with same natural order.
      const docs = planned
        .filter((p) => !p.mutatesBalance)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const mutations = planned
        .filter((p) => p.mutatesBalance)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      let running = 0;
      let importedDocs = 0;
      let appliedMutations = 0;

      for (const op of docs) {
        const balanceAfter = running + op.delta;
        if (!dryRun) {
          const res = await this.ledger.importHistorical(
            {
              studentId,
              delta: op.delta,
              operationType: op.operationType,
              sourceType: op.sourceType,
              sourceId: op.sourceId,
              idempotencyKey: op.idempotencyKey,
              description: op.description,
              createdByUserId: op.createdByUserId,
              balanceBefore: running,
              balanceAfter,
              createdAt: op.createdAt,
            },
            manager,
          );
          if (res.inserted) {
            importedDocs += 1;
          }
        } else {
          importedDocs += 1;
        }
        running = balanceAfter;
      }

      // Gap between documented history and the live counter BEFORE orphan restores.
      const gapBeforeMutations = balanceBefore - running;

      // Orphan restores: these were never applied to the counter — apply via ledger.
      for (const op of mutations) {
        if (!dryRun) {
          const res = await this.ledger.apply(
            {
              studentId,
              delta: op.delta,
              operationType: op.operationType,
              sourceType: op.sourceType,
              sourceId: op.sourceId,
              idempotencyKey: op.idempotencyKey,
              description: op.description,
              createdByUserId: op.createdByUserId,
            },
            manager,
          );
          if (res.applied) {
            appliedMutations += 1;
          }
        } else {
          appliedMutations += 1;
          // dry-run: simulate counter move
          student.lessonBalance = (student.lessonBalance ?? 0) + op.delta;
        }
        running += op.delta;
      }

      const fresh = dryRun
        ? student
        : await manager.getRepository(StudentEntity).findOne({ where: { id: studentId } });
      const balanceAfterMutations = fresh?.lessonBalance ?? balanceBefore;
      // After mutations, ledger running should track balanceAfterMutations - gapBeforeMutations... 
      // Actually: docs sum = running_before_mutations. After mutations running includes restores.
      // Live balance after mutations = balanceBefore + applied_restore_deltas.
      // Remaining unexplained = balanceAfterMutations - running (if we applied all mutations in running).

      let legacyReconciliationDelta = 0;
      const unexplained = balanceAfterMutations - running;
      if (unexplained !== 0) {
        legacyReconciliationDelta = unexplained;
        const reconKey = StudentBalanceLedgerService.legacyReconKey(studentId);
        if (!dryRun) {
          await this.ledger.importHistorical(
            {
              studentId,
              delta: unexplained,
              operationType: 'legacy_reconciliation',
              sourceType: 'legacy',
              sourceId: studentId,
              idempotencyKey: reconKey,
              description:
                `LEGACY_RECONCILIATION confidence=LOW: historical balance delta ` +
                `could not be reconstructed from retained records (gap=${unexplained}; ` +
                `pre-mutation gap=${gapBeforeMutations})`,
              createdByUserId: null,
              balanceBefore: running,
              balanceAfter: running + unexplained,
              createdAt: new Date(student.updatedAt ?? student.createdAt ?? Date.now()),
            },
            manager,
          );
        }
        running += unexplained;
      }

      const ledgerSum = dryRun
        ? running
        : await this.sumLedger(manager, studentId);
      const balanceAfter = dryRun
        ? balanceAfterMutations
        : ((await manager.getRepository(StudentEntity).findOne({ where: { id: studentId } }))
            ?.lessonBalance ?? balanceAfterMutations);

      const reconciled = ledgerSum === balanceAfter;
      if (!reconciled) {
        this.logger.error(
          `Student ${studentId} not reconciled: ledger=${ledgerSum} balance=${balanceAfter}`,
        );
      }

      return {
        studentId,
        name: student.name,
        balanceBefore,
        balanceAfter,
        balanceChanged: balanceAfter !== balanceBefore,
        importedDocs,
        appliedMutations,
        legacyReconciliationDelta,
        ledgerSum,
        reconciled,
      };
    });
  }

  private async sumLedger(manager: EntityManager, studentId: string): Promise<number> {
    const raw = await manager.query(
      `SELECT COALESCE(SUM(delta), 0)::int AS sum FROM student_balance_ledger WHERE student_id = $1`,
      [studentId],
    );
    return Math.trunc(Number(raw?.[0]?.sum) || 0);
  }

  private async buildPlan(
    student: StudentEntity,
    manager: EntityManager,
  ): Promise<PlannedOp[]> {
    const ops: PlannedOp[] = [];
    const studentId = student.id;

    // --- Initial balance from first payment audit "balance X → Y" when X ≠ 0 ---
    const firstPayAudit = await manager.query(
      `SELECT created_date, summary FROM audit_logs
       WHERE entity_id = $1 AND action = 'lesson_balance_change'
         AND summary LIKE 'manual payment%'
       ORDER BY created_date ASC LIMIT 1`,
      [studentId],
    );
    if (firstPayAudit?.[0]?.summary) {
      const m = String(firstPayAudit[0].summary).match(
        /balance\s+(-?\d+)\s*→\s*(-?\d+)/,
      );
      if (m) {
        const before = Number(m[1]);
        if (before !== 0) {
          ops.push({
            studentId,
            delta: before,
            operationType: 'initial',
            sourceType: 'student_create',
            sourceId: studentId,
            idempotencyKey: StudentBalanceLedgerService.legacyInitialKey(studentId),
            description: `legacy initial balance inferred from first payment audit (${before})`,
            createdAt: new Date(student.createdAt ?? firstPayAudit[0].created_date),
            createdByUserId: null,
            mutatesBalance: false,
          });
        }
      }
    } else if ((student.lessonBalance ?? 0) !== 0) {
      // No payment audits — check create-time non-zero later via reconciliation.
    }

    // --- Paid payments (lesson credits) ---
    const payments = await manager.query(
      `SELECT p.id, p.lessons_added, p.created_at, p.paid_at, p.shop_item_id, s.type AS shop_type
       FROM payments p
       LEFT JOIN shop_items s ON s.id = p.shop_item_id
       WHERE p.student_id = $1 AND p.status = 'paid' AND COALESCE(p.lessons_added, 0) <> 0
       ORDER BY COALESCE(p.paid_at, p.created_at) ASC`,
      [studentId],
    );
    for (const p of payments as Array<{
      id: string;
      lessons_added: number;
      created_at: Date;
      paid_at: Date | null;
      shop_item_id: string | null;
      shop_type: string | null;
    }>) {
      const should =
        !p.shop_item_id
          ? Number(p.lessons_added) !== 0
          : p.shop_type === 'package';
      if (!should) {
        continue;
      }
      const delta = Math.trunc(Number(p.lessons_added) || 0);
      if (delta === 0) {
        continue;
      }
      ops.push({
        studentId,
        delta,
        operationType: delta > 0 ? 'credit' : 'debit',
        sourceType: 'payment',
        sourceId: p.id,
        idempotencyKey: StudentBalanceLedgerService.legacyPaymentKey(p.id),
        description: `legacy payment credit ${p.id} lessons_added=${delta}`,
        createdAt: new Date(p.paid_at ?? p.created_at),
        createdByUserId: null,
        mutatesBalance: false,
      });
    }

    // --- Lesson debits from audit_logs ---
    const debitAudits = await manager.query(
      `SELECT created_date, summary FROM audit_logs
       WHERE entity_id = $1 AND action = 'lesson_balance_change'
         AND summary LIKE 'lesson_deduct %'
       ORDER BY created_date ASC`,
      [studentId],
    );
    const debitLessonIds = new Set<string>();
    for (const row of debitAudits as Array<{ created_date: Date; summary: string }>) {
      const m = String(row.summary).match(
        /lesson_deduct\s+([0-9a-f-]{36})\s+status=(\S+)/i,
      );
      if (!m) {
        continue;
      }
      const lessonId = m[1];
      if (debitLessonIds.has(lessonId)) {
        continue;
      }
      debitLessonIds.add(lessonId);
      ops.push({
        studentId,
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: StudentBalanceLedgerService.debitKey(lessonId, studentId),
        description: `legacy lesson_deduct ${lessonId} (from audit)`,
        createdAt: new Date(row.created_date),
        createdByUserId: null,
        mutatesBalance: false,
      });
    }

    // --- Attendance-only debits (completed/missed_no_notice) not in audit ---
    const attendanceDebits = await manager.query(
      `SELECT a.lesson_id, a.updated_at, a.created_at, l.status, l.date
       FROM attendance_records a
       JOIN lessons l ON l.id = a.lesson_id
       WHERE a.student_id = $1 AND a.balance_deducted = true`,
      [studentId],
    );
    for (const row of attendanceDebits as Array<{
      lesson_id: string;
      updated_at: Date;
      created_at: Date;
      status: string;
      date: string;
    }>) {
      if (debitLessonIds.has(row.lesson_id)) {
        continue;
      }
      debitLessonIds.add(row.lesson_id);
      ops.push({
        studentId,
        delta: -1,
        operationType: 'debit',
        sourceType: 'attendance',
        sourceId: row.lesson_id,
        idempotencyKey: StudentBalanceLedgerService.debitKey(row.lesson_id, studentId),
        description: `legacy attendance debit lesson ${row.lesson_id} status=${row.status}`,
        createdAt: new Date(row.updated_at ?? row.created_at),
        createdByUserId: null,
        mutatesBalance: false,
      });
    }

    // --- Contact-linked attendance debits ---
    const contactDebits = await manager.query(
      `SELECT a.lesson_id, a.updated_at, a.created_at, c.id AS contact_id
       FROM attendance_records a
       JOIN teacher_student_contacts c ON c.id = a.teacher_student_contact_id
       JOIN lessons l ON l.id = a.lesson_id
       WHERE c.linked_student_id = $1
         AND c.owner_type = 'teacher'
         AND a.balance_deducted = true`,
      [studentId],
    );
    for (const row of contactDebits as Array<{
      lesson_id: string;
      updated_at: Date;
      created_at: Date;
      contact_id: string;
    }>) {
      if (debitLessonIds.has(row.lesson_id)) {
        continue;
      }
      debitLessonIds.add(row.lesson_id);
      ops.push({
        studentId,
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: row.lesson_id,
        idempotencyKey: StudentBalanceLedgerService.debitKey(row.lesson_id, studentId),
        description: `legacy contact lesson debit ${row.lesson_id} contact=${row.contact_id}`,
        createdAt: new Date(row.updated_at ?? row.created_at),
        createdByUserId: null,
        mutatesBalance: false,
      });
    }

    // --- Orphan restores: debit audited, lesson row gone ---
    for (const lessonId of debitLessonIds) {
      const exists = await manager.query(
        `SELECT 1 FROM lessons WHERE id = $1 LIMIT 1`,
        [lessonId],
      );
      if (exists?.length) {
        continue;
      }
      // Also skip if a restore audit already existed historically (rare).
      const restoreAudit = await manager.query(
        `SELECT 1 FROM audit_logs
         WHERE entity_id = $1 AND action = 'lesson_balance_change'
           AND summary LIKE $2 LIMIT 1`,
        [studentId, `%lesson_restore ${lessonId}%`],
      );
      if (restoreAudit?.length) {
        // Historical restore was applied to counter — document it without mutate.
        ops.push({
          studentId,
          delta: 1,
          operationType: 'restore',
          sourceType: 'lesson',
          sourceId: lessonId,
          idempotencyKey: StudentBalanceLedgerService.restoreKey(lessonId, studentId),
          description: `legacy lesson_restore ${lessonId} (from audit)`,
          createdAt: new Date(),
          createdByUserId: null,
          mutatesBalance: false,
        });
        continue;
      }
      // Debit stuck after DELETE — apply restore (mutates counter).
      ops.push({
        studentId,
        delta: 1,
        operationType: 'restore',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: StudentBalanceLedgerService.restoreKey(lessonId, studentId),
        description: `orphan deleted-lesson restore ${lessonId}`,
        createdAt: new Date(),
        createdByUserId: null,
        mutatesBalance: true,
      });
    }

    // --- Manual adjustments table ---
    const adjustments = await manager.query(
      `SELECT id, change_amount, reason, created_at, created_by, old_balance, new_balance
       FROM student_lesson_balance_adjustments
       WHERE student_id = $1
       ORDER BY created_at ASC`,
      [studentId],
    );
    for (const a of adjustments as Array<{
      id: string;
      change_amount: number;
      reason: string;
      created_at: Date;
      created_by: string | null;
      old_balance: number;
      new_balance: number;
    }>) {
      const delta = Math.trunc(Number(a.change_amount) || 0);
      if (delta === 0) {
        continue;
      }
      ops.push({
        studentId,
        delta,
        operationType: 'adjustment',
        sourceType: 'adjustment',
        sourceId: a.id,
        idempotencyKey: StudentBalanceLedgerService.legacyAdjustmentKey(a.id),
        description:
          a.reason?.trim()
            ? `legacy adjustment ${a.old_balance}→${a.new_balance} (${a.reason})`
            : `legacy adjustment ${a.old_balance}→${a.new_balance}`,
        createdAt: new Date(a.created_at),
        createdByUserId: a.created_by,
        mutatesBalance: false,
      });
    }

    // --- Contact balance history (teacher→linked student SSOT writes) ---
    // Only when this student has no CRM lesson-debit trail — otherwise contact
    // "Списание" rows mirror CRM audits and would double-count.
    const hasCrmDebitTrail = debitLessonIds.size > 0;
    const contactHist = await manager.query(
      `SELECT h.id, h.change_amount, h.reason, h.created_at, h.created_by
       FROM teacher_student_balance_history h
       JOIN teacher_student_contacts c ON c.id = h.student_contact_id
       WHERE c.linked_student_id = $1
         AND c.owner_type = 'teacher'
         AND COALESCE(h.change_amount, 0) <> 0
       ORDER BY h.created_at ASC`,
      [studentId],
    );
    for (const h of contactHist as Array<{
      id: string;
      change_amount: number;
      reason: string | null;
      created_at: Date;
      created_by: string | null;
    }>) {
      const delta = Math.trunc(Number(h.change_amount) || 0);
      if (delta === 0) {
        continue;
      }
      const reason = String(h.reason ?? '');
      const isLessonSideEffect =
        reason.includes('Списание за проведённый урок') ||
        reason.includes('Возврат за отменённый урок');
      if (isLessonSideEffect && hasCrmDebitTrail) {
        continue;
      }
      ops.push({
        studentId,
        delta,
        operationType: isLessonSideEffect
          ? delta < 0
            ? 'debit'
            : 'restore'
          : 'adjustment',
        sourceType: 'legacy',
        sourceId: h.id,
        idempotencyKey: `legacy:contact_history:${h.id}`,
        description: `legacy contact history ${h.id}: ${reason || 'contact balance change'}`,
        createdAt: new Date(h.created_at),
        createdByUserId: h.created_by,
        mutatesBalance: false,
      });
    }

    // Deduplicate by idempotency key (keep earliest).
    const seen = new Set<string>();
    const unique: PlannedOp[] = [];
    for (const op of ops.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (seen.has(op.idempotencyKey)) {
        continue;
      }
      seen.add(op.idempotencyKey);
      unique.push(op);
    }
    return unique;
  }
}
