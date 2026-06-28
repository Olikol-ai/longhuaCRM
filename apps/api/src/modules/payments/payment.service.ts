import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PaymentEntity } from '../../entities/Payment.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { CourseEntity } from '../../entities/Course.entity';
import { paymentToRecord, recordToPaymentPayload } from './payment.mapper';

@Injectable()
export class PaymentService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const studentId = String(input.student_id ?? '');
    if (!studentId) {
      throw new BadRequestException('student_id is required');
    }

    const lessonsAdded = Number(input.lessons_added ?? 0);
    const status = (input.status as PaymentEntity['status']) ?? 'paid';
    const provider = (input.provider as PaymentEntity['provider']) ?? 'manual';
    const packageType = input.package_type ? String(input.package_type) : null;

    return this.dataSource.transaction(async (manager) => {
      const studentRepo = manager.getRepository(StudentEntity);
      const paymentRepo = manager.getRepository(PaymentEntity);

      const student = await studentRepo.findOne({ where: { id: studentId } });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const now = new Date();
      const paymentDate =
        input.payment_date != null
          ? String(input.payment_date)
          : now.toISOString().split('T')[0];

      const payload = recordToPaymentPayload({
        ...input,
        status: input.status ?? status,
        provider: input.provider ?? provider,
        package_type: input.package_type ?? packageType,
      });

      const row = paymentRepo.create({
        id: input.id ? String(input.id) : randomUUID(),
        ...payload,
        studentId,
        studentName: String(input.student_name ?? student.name ?? ''),
        lessonsAdded,
        paymentDate,
        paidAt: (input.status ?? status) === 'paid' ? now : undefined,
        createdDate: now,
        updatedDate: now,
      });

      const saved = await paymentRepo.save(row);

      if (this.shouldApplyBalance(saved)) {
        await this.applyBalanceDelta(studentRepo, student, lessonsAdded);
      }

      return paymentToRecord(saved);
    });
  }

  async update(id: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);

      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      const previousLessons = row.lessonsAdded ?? 0;
      const wasBalanceApplied = this.shouldApplyBalance(row);

      Object.assign(row, recordToPaymentPayload(input));
      if (input.comment !== undefined) {
        row.notes = String(input.comment);
      }
      row.updatedDate = new Date();

      const saved = await paymentRepo.save(row);
      const nowApplies = this.shouldApplyBalance(saved);

      if (wasBalanceApplied || nowApplies) {
        const student = await studentRepo.findOne({ where: { id: saved.studentId } });
        if (student) {
          const previousEffect = wasBalanceApplied ? previousLessons : 0;
          const nextEffect = nowApplies ? (saved.lessonsAdded ?? 0) : 0;
          const delta = nextEffect - previousEffect;
          if (delta !== 0) {
            await this.applyBalanceDelta(studentRepo, student, delta);
          }
        }
      }

      return paymentToRecord(saved);
    });
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);

      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      if (this.shouldApplyBalance(row)) {
        const student = await studentRepo.findOne({ where: { id: row.studentId } });
        if (student) {
          await this.applyBalanceDelta(studentRepo, student, -(row.lessonsAdded ?? 0));
        }
      }

      await paymentRepo.delete({ id });
    });
  }

  async markPaidFromWebhook(params: {
    orderNumber: string;
    externalOrderId: string;
    comment: string;
  }): Promise<{ applied: boolean; paymentId?: string; student?: StudentEntity; lessonsAdded?: number; packageType?: string | null; amount?: number }> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);
      const courseRepo = manager.getRepository(CourseEntity);

      const row = await paymentRepo.findOne({
        where: { orderNumber: params.orderNumber },
      });
      if (!row || row.status === 'paid') {
        return { applied: false };
      }

      row.status = 'paid';
      row.paidAt = new Date();
      row.externalId = params.externalOrderId;
      row.notes = params.comment;
      row.updatedDate = new Date();
      await paymentRepo.save(row);

      const student = await studentRepo.findOne({ where: { id: row.studentId } });
      if (!student) {
        return { applied: true, paymentId: row.id };
      }

      if (row.packageType === 'package') {
        const lessonsAdded = row.lessonsAdded ?? 0;
        await this.applyBalanceDelta(studentRepo, student, lessonsAdded);
        const refreshed = await studentRepo.findOne({ where: { id: row.studentId } });
        return {
          applied: true,
          paymentId: row.id,
          student: refreshed ?? student,
          lessonsAdded,
          packageType: row.packageType,
          amount: Number(row.amount),
        };
      }

      if (row.packageType === 'course') {
        const courseType = String(row.notes || '').includes('basic')
          ? 'basic_beginner'
          : 'advanced';
        await courseRepo.save(
          courseRepo.create({
            id: randomUUID(),
            studentId: row.studentId,
            studentName: student.name,
            courseType,
            courseName: row.notes || 'Курс',
            totalLessons: 35,
            completedLessons: 0,
            startDate: new Date().toISOString().split('T')[0],
            status: 'active',
            createdDate: new Date(),
            updatedDate: new Date(),
          }),
        );
        return {
          applied: true,
          paymentId: row.id,
          student,
          packageType: row.packageType,
          amount: Number(row.amount),
        };
      }

      return { applied: true, paymentId: row.id };
    });
  }

  toRecord(row: PaymentEntity): Record<string, unknown> {
    return paymentToRecord(row);
  }

  private shouldApplyBalance(payment: PaymentEntity): boolean {
    return payment.status === 'paid' && payment.packageType !== 'course';
  }

  private async applyBalanceDelta(
    studentRepo: Repository<StudentEntity>,
    student: StudentEntity,
    delta: number,
  ): Promise<void> {
    student.lessonBalance = Math.max(0, (student.lessonBalance ?? 0) + delta);
    student.updatedDate = new Date();
    await studentRepo.save(student);
  }
}
