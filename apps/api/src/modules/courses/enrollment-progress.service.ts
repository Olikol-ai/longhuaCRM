import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { CertificateDraftService } from '../certificates/certificate-draft.service';
import { EnrollmentEntity } from './entities/enrollment.entity';

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
      const studentIds = attendance.map((row) => row.studentId);
      if (studentIds.length === 0 && lesson.primaryStudentId) {
        studentIds.push(lesson.primaryStudentId);
      }

      for (const studentId of studentIds) {
        await this.incrementCompleted(studentId, courseId, em);
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

      await this.incrementMissed(studentId, courseId, em);
    };

    if (manager) {
      await run(manager);
      return;
    }

    await this.dataSource.transaction(run);
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

  private async incrementCompleted(
    studentId: string,
    courseTemplateId: string,
    em: EntityManager,
  ): Promise<void> {
    const repo = em.getRepository(EnrollmentEntity);
    const enrollment = await repo.findOne({
      where: { studentId, courseTemplateId, status: In(['active', 'completed']) },
      order: { createdAt: 'DESC' },
    });
    if (!enrollment || enrollment.status === 'completed') {
      return;
    }

    enrollment.completedLessons = (enrollment.completedLessons ?? 0) + 1;
    if (enrollment.completedLessons >= enrollment.totalLessons) {
      enrollment.status = 'completed';
    }
    await repo.save(enrollment);

    if (enrollment.status === 'completed') {
      await this.certificateDraftService.createDraftForEnrollment(enrollment, em);
    }
  }

  private async incrementMissed(
    studentId: string,
    courseTemplateId: string,
    em: EntityManager,
  ): Promise<void> {
    const repo = em.getRepository(EnrollmentEntity);
    const enrollment = await repo.findOne({
      where: { studentId, courseTemplateId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    if (!enrollment) {
      return;
    }

    enrollment.missedLessons = (enrollment.missedLessons ?? 0) + 1;
    await repo.save(enrollment);
  }
}
