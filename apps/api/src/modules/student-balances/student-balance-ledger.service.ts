import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { StudentEntity } from '../students/entities/student.entity';
import {
  StudentBalanceLedgerEntity,
  StudentBalanceOperationType,
  StudentBalanceSourceType,
} from './entities/student-balance-ledger.entity';

export type ApplyBalanceOperationInput = {
  studentId: string;
  delta: number;
  operationType: StudentBalanceOperationType;
  sourceType: StudentBalanceSourceType;
  sourceId?: string | null;
  idempotencyKey: string;
  description?: string | null;
  createdByUserId?: string | null;
};

export type ApplyBalanceOperationResult = {
  applied: boolean;
  entry: StudentBalanceLedgerEntity;
  balanceBefore: number;
  balanceAfter: number;
};

@Injectable()
export class StudentBalanceLedgerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Atomically apply a balance delta with unique idempotency_key.
   * Replays of the same key return the existing ledger row without mutating again.
   */
  async apply(
    input: ApplyBalanceOperationInput,
    manager?: EntityManager,
  ): Promise<ApplyBalanceOperationResult> {
    const delta = Math.trunc(Number(input.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('Balance delta must be a non-zero integer');
    }
    const key = String(input.idempotencyKey || '').trim();
    if (!key || key.length > 191) {
      throw new BadRequestException('idempotencyKey is required (max 191 chars)');
    }

    const run = async (em: EntityManager): Promise<ApplyBalanceOperationResult> => {
      const existing = await em.getRepository(StudentBalanceLedgerEntity).findOne({
        where: { idempotencyKey: key },
      });
      if (existing) {
        return {
          applied: false,
          entry: existing,
          balanceBefore: existing.balanceBefore,
          balanceAfter: existing.balanceAfter,
        };
      }

      const studentRepo = em.getRepository(StudentEntity);
      const student = await studentRepo.findOne({
        where: { id: input.studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      // Re-check after lock (another txn may have won the race).
      const existingAfterLock = await em
        .getRepository(StudentBalanceLedgerEntity)
        .findOne({ where: { idempotencyKey: key } });
      if (existingAfterLock) {
        return {
          applied: false,
          entry: existingAfterLock,
          balanceBefore: existingAfterLock.balanceBefore,
          balanceAfter: existingAfterLock.balanceAfter,
        };
      }

      const balanceBefore = student.lessonBalance ?? 0;
      const balanceAfter = balanceBefore + delta;

      try {
        // Insert ledger first so a unique violation never leaves a counter-only mutation.
        const entry = await em.getRepository(StudentBalanceLedgerEntity).save(
          em.getRepository(StudentBalanceLedgerEntity).create({
            studentId: input.studentId,
            delta,
            balanceBefore,
            balanceAfter,
            operationType: input.operationType,
            sourceType: input.sourceType,
            sourceId: input.sourceId ?? null,
            idempotencyKey: key,
            description: input.description ?? null,
            createdByUserId: input.createdByUserId ?? null,
          }),
        );
        student.lessonBalance = balanceAfter;
        await studentRepo.save(student);
        return { applied: true, entry, balanceBefore, balanceAfter };
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          const raced = await em.getRepository(StudentBalanceLedgerEntity).findOne({
            where: { idempotencyKey: key },
          });
          if (raced) {
            return {
              applied: false,
              entry: raced,
              balanceBefore: raced.balanceBefore,
              balanceAfter: raced.balanceAfter,
            };
          }
        }
        throw err;
      }
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  /** Set absolute balance via adjustment (delta = target − current). */
  async setAbsolute(
    input: {
      studentId: string;
      newBalance: number;
      sourceType: StudentBalanceSourceType;
      sourceId?: string | null;
      idempotencyKey: string;
      description?: string | null;
      createdByUserId?: string | null;
      operationType?: StudentBalanceOperationType;
    },
    manager?: EntityManager,
  ): Promise<ApplyBalanceOperationResult | { applied: false; balanceAfter: number }> {
    const run = async (em: EntityManager) => {
      const existing = await em.getRepository(StudentBalanceLedgerEntity).findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return {
          applied: false as const,
          entry: existing,
          balanceBefore: existing.balanceBefore,
          balanceAfter: existing.balanceAfter,
        };
      }

      const student = await em.getRepository(StudentEntity).findOne({
        where: { id: input.studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }
      const target = Math.trunc(Number(input.newBalance));
      if (!Number.isFinite(target)) {
        throw new BadRequestException('newBalance must be an integer');
      }
      const before = student.lessonBalance ?? 0;
      if (before === target) {
        return { applied: false as const, balanceAfter: before };
      }
      return this.apply(
        {
          studentId: input.studentId,
          delta: target - before,
          operationType: input.operationType ?? 'adjustment',
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          idempotencyKey: input.idempotencyKey,
          description: input.description,
          createdByUserId: input.createdByUserId,
        },
        em,
      );
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  async sumDeltaForStudent(studentId: string): Promise<number> {
    const raw = await this.dataSource
      .getRepository(StudentBalanceLedgerEntity)
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.delta), 0)', 'sum')
      .where('l.student_id = :studentId', { studentId })
      .getRawOne<{ sum: string }>();
    return Math.trunc(Number(raw?.sum) || 0);
  }

  async listForStudent(
    studentId: string,
    limit = 200,
  ): Promise<StudentBalanceLedgerEntity[]> {
    return this.dataSource.getRepository(StudentBalanceLedgerEntity).find({
      where: { studentId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  }

  async findByIdempotencyKey(
    key: string,
    manager?: EntityManager,
  ): Promise<StudentBalanceLedgerEntity | null> {
    const repo = (manager ?? this.dataSource).getRepository(StudentBalanceLedgerEntity);
    return repo.findOne({ where: { idempotencyKey: key } });
  }

  static debitKey(lessonId: string, studentId: string): string {
    return `lesson:${lessonId}:student:${studentId}:debit`;
  }

  static restoreKey(lessonId: string, studentId: string): string {
    return `lesson:${lessonId}:student:${studentId}:restore`;
  }

  static paymentCreditKey(paymentId: string, version: string | number): string {
    return `payment:${paymentId}:credit:v${version}`;
  }

  static paymentDeltaKey(paymentId: string, version: string | number): string {
    return `payment:${paymentId}:delta:v${version}`;
  }

  static adjustmentKey(adjustmentId: string): string {
    return `adjustment:${adjustmentId}`;
  }

  static initialKey(studentId: string): string {
    return `student:${studentId}:initial`;
  }

  static mergeInKey(primaryId: string, secondaryId: string): string {
    return `merge:${primaryId}:from:${secondaryId}:in`;
  }

  static mergeOutKey(primaryId: string, secondaryId: string): string {
    return `merge:${primaryId}:from:${secondaryId}:out`;
  }

  static legacyReconKey(studentId: string, version = 'v1'): string {
    return `legacy:recon:student:${studentId}:${version}`;
  }

  static legacyPaymentKey(paymentId: string): string {
    return `legacy:payment:${paymentId}:credit`;
  }

  static legacyInitialKey(studentId: string): string {
    return `legacy:student:${studentId}:initial`;
  }

  static legacyAdjustmentKey(adjustmentId: string): string {
    return `legacy:adjustment:${adjustmentId}`;
  }

  /**
   * Insert a historical ledger row WITHOUT mutating students.lesson_balance.
   * Used by legacy import when the delta is already reflected in the counter.
   * Idempotent via unique idempotency_key.
   */
  async importHistorical(
    input: ApplyBalanceOperationInput & {
      balanceBefore: number;
      balanceAfter: number;
      createdAt: Date;
    },
    manager?: EntityManager,
  ): Promise<{ inserted: boolean; entry: StudentBalanceLedgerEntity }> {
    const delta = Math.trunc(Number(input.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('Balance delta must be a non-zero integer');
    }
    const key = String(input.idempotencyKey || '').trim();
    if (!key || key.length > 191) {
      throw new BadRequestException('idempotencyKey is required (max 191 chars)');
    }

    const run = async (em: EntityManager) => {
      const existing = await em.getRepository(StudentBalanceLedgerEntity).findOne({
        where: { idempotencyKey: key },
      });
      if (existing) {
        return { inserted: false, entry: existing };
      }

      try {
        const entry = await em.getRepository(StudentBalanceLedgerEntity).save(
          em.getRepository(StudentBalanceLedgerEntity).create({
            studentId: input.studentId,
            delta,
            balanceBefore: Math.trunc(input.balanceBefore),
            balanceAfter: Math.trunc(input.balanceAfter),
            operationType: input.operationType,
            sourceType: input.sourceType,
            sourceId: input.sourceId ?? null,
            idempotencyKey: key,
            description: input.description ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: input.createdAt,
          }),
        );
        return { inserted: true, entry };
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          const raced = await em.getRepository(StudentBalanceLedgerEntity).findOne({
            where: { idempotencyKey: key },
          });
          if (raced) {
            return { inserted: false, entry: raced };
          }
        }
        throw err;
      }
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  private isUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) {
      return false;
    }
    const code = (err as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code;
    return code === '23505';
  }
}
