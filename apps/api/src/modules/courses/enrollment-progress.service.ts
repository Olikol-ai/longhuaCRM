import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { CertificateDraftService } from '../certificates/certificate-draft.service';
import { EnrollmentEntity } from './entities/enrollment.entity';
import {
  EnrollmentLessonEventEntity,
  EnrollmentLessonEventType,
} from './entities/enrollment-lesson-event.entity';

export type EnrollmentProgress = {
  enrollmentId: string;
  completedLessons: number;
  missedLessons: number;
  totalLessons: number;
  remainingLessons: number;
  status: EnrollmentEntity['status'];
};

@Injectable()
export class EnrollmentProgressService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly certificateDraftService: CertificateDraftService,
  ) {}

  computeRemaining(enrollment: EnrollmentEntity): number {
    return Math.max(
      0,
      (enrollment.totalLessons ?? 0) -
        (enrollment.completedLessons ?? 0) -
        (enrollment.missedLessons ?? 0),
    );
  }

  toProgress(enrollment: EnrollmentEntity): EnrollmentProgress {
    return {
      enrollmentId: enrollment.id,
      completedLessons: enrollment.completedLessons ?? 0,
      missedLessons: enrollment.missedLessons ?? 0,
      totalLessons: enrollment.totalLessons ?? 0,
      remainingLessons: this.computeRemaining(enrollment),
      status: enrollment.status,
    };
  }

  async handleLessonCompleted(lessonId: string, manager?: EntityManager): Promise<void> {
    const run = async (em: EntityManager) => {
      const lesson = await em.getRepository(LessonEntity).findOne({ where: { id: lessonId } });
      if (!lesson) {
        return;
      }

      const courseId = await this.resolveCourseId(lesson, em);
      if (!courseId) {
        return;
      }

      const attendance = await em.getRepository(AttendanceEntity).find({
        where: { lessonId: lesson.id },
      });
      const studentIds = attendance
        .map((row) => row.studentId)
        .filter((id): id is string => Boolean(id));
      if (studentIds.length === 0 && lesson.primaryStudentId) {
        studentIds.push(lesson.primaryStudentId);
      }

      for (const studentId of studentIds) {
        await this.recordProgressEvent(studentId, courseId, lessonId, 'completed', em);
      }
    };

    if (manager) {
      await run(manager);
      return;
    }

    await this.dataSource.transaction(run);
  }

  async handleLessonMissed(
    lessonId: string,
    studentId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const lesson = await em.getRepository(LessonEntity).findOne({ where: { id: lessonId } });
      if (!lesson) {
        return;
      }

      const courseId = await this.resolveCourseId(lesson, em);
      if (!courseId) {
        return;
      }

      await this.recordProgressEvent(studentId, courseId, lessonId, 'missed', em);
    };

    if (manager) {
      await run(manager);
      return;
    }

    await this.dataSource.transaction(run);
  }

  private async recordProgressEvent(
    studentId: string,
    courseTemplateId: string,
    lessonId: string,
    eventType: EnrollmentLessonEventType,
    em: EntityManager,
  ): Promise<void> {
    const enrollmentRepo = em.getRepository(EnrollmentEntity);
    const eventRepo = em.getRepository(EnrollmentLessonEventEntity);

    const enrollment = await enrollmentRepo.findOne({
      where:
        eventType === 'completed'
          ? { studentId, courseTemplateId, status: In(['active', 'completed']) }
          : { studentId, courseTemplateId, status: 'active' },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (!enrollment) {
      return;
    }

    if (eventType === 'completed' && enrollment.status === 'completed') {
      return;
    }

    const existingEvent = await eventRepo.findOne({
      where: { lessonId, studentId, eventType },
    });
    if (existingEvent) {
      return;
    }

    try {
      await eventRepo.save(
        eventRepo.create({
          enrollmentId: enrollment.id,
          lessonId,
          studentId,
          eventType,
        }),
      );
    } catch {
      return;
    }

    if (eventType === 'completed') {
      enrollment.completedLessons = (enrollment.completedLessons ?? 0) + 1;
      if (enrollment.completedLessons >= enrollment.totalLessons) {
        enrollment.status = 'completed';
      }
      await enrollmentRepo.save(enrollment);

      if (enrollment.status === 'completed') {
        await this.certificateDraftService.createDraftForEnrollment(enrollment, em);
      }
      return;
    }

    enrollment.missedLessons = (enrollment.missedLessons ?? 0) + 1;
    await enrollmentRepo.save(enrollment);
  }

  private async resolveCourseId(lesson: LessonEntity, em: EntityManager): Promise<string | null> {
    if (lesson.seriesId) {
      const series = await em.getRepository(LessonSeriesEntity).findOne({
        where: { id: lesson.seriesId },
      });
      return series?.courseId ?? null;
    }
    return null;
  }
}
