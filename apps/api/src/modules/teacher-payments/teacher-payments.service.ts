import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { filterToEntityWhere } from '../../common/utils/api-record.util';
import { JwtPayload } from '../auth/auth.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherPaymentEntity } from './entities/teacher-payment.entity';
import { UpdateTeacherPaymentDto } from './dto/update-teacher-payment.dto';
import { TeacherPaymentsRepository } from './teacher-payments.repository';
import { aggregateTeacherPaymentsByPeriod } from './teacher-pay-periods';

@Injectable()
export class TeacherPaymentsService {
  constructor(
    private readonly repository: TeacherPaymentsRepository,
    private readonly teacherAccess: TeacherAccessService,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
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
}
