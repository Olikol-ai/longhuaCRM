import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { TelegramService } from '../../telegram/telegram.service';
import { EnrollmentEntity } from '../../courses/entities/enrollment.entity';
import { GroupMemberEntity } from '../../groups/entities/group-member.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { AssessmentExamAssignmentEntity } from '../entities/assessment-exam-assignment.entity';
import { AssessmentExamEntity } from '../entities/assessment-exam.entity';
import { AssignmentTargetType } from '../enums';

/**
 * Notifies students when an Assignment is created.
 * Called from the controller (not AssignmentService) to keep business service unchanged.
 */
@Injectable()
export class AssessmentAssignmentNotifier {
  private readonly logger = new Logger(AssessmentAssignmentNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMembers: Repository<GroupMemberEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollments: Repository<EnrollmentEntity>,
    @InjectRepository(AssessmentExamEntity)
    private readonly exams: Repository<AssessmentExamEntity>,
  ) {}

  notifyAssignmentCreated(assignment: AssessmentExamAssignmentEntity): void {
    void this.notifySafe(assignment);
  }

  private async notifySafe(assignment: AssessmentExamAssignmentEntity): Promise<void> {
    try {
      const exam = await this.exams.findOne({ where: { id: assignment.examId } });
      const examName = exam?.name?.trim() || 'Экзамен';
      const students = await this.resolveStudents(assignment);
      const startUrl = this.buildStartUrl();

      const deadline =
        assignment.validTo != null
          ? new Date(assignment.validTo).toLocaleString('ru-RU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'без срока';

      const title = 'Вам назначен новый экзамен';
      const body = [
        `Название: ${examName}`,
        `Срок прохождения: ${deadline}`,
        '',
        'Откройте раздел «Мои экзамены», чтобы начать.',
      ].join('\n');

      for (const student of students) {
        if (!student.userId) continue;
        const user = await this.users.findOne({ where: { id: student.userId } });
        const telegramId =
          user?.telegramId?.trim() || student.telegramId?.trim() || '';

        await this.notifications.create({
          userId: student.userId,
          channel: 'in_app',
          type: 'assessment_assignment',
          title,
          body,
          status: 'pending',
          referenceType: 'assessment_assignment',
          referenceId: assignment.id,
        });

        if (telegramId) {
          const sent = await this.telegram.sendMessage(
            telegramId,
            `${title}\n\n${body}`,
            {
              replyMarkup: {
                inline_keyboard: [[{ text: 'Начать экзамен', url: startUrl }]],
              },
            },
          );
          await this.notifications.create({
            userId: student.userId,
            channel: 'telegram',
            type: 'assessment_assignment',
            title,
            body,
            status: sent.ok ? 'sent' : 'failed',
            referenceType: 'assessment_assignment',
            referenceId: assignment.id,
          });
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to notify about assignment ${assignment.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async resolveStudents(
    assignment: AssessmentExamAssignmentEntity,
  ): Promise<StudentEntity[]> {
    switch (assignment.targetType) {
      case AssignmentTargetType.Student: {
        const row = await this.students.findOne({
          where: { id: assignment.targetId },
        });
        return row ? [row] : [];
      }
      case AssignmentTargetType.Group:
      case AssignmentTargetType.CorporateGroup: {
        const members = await this.groupMembers.find({
          where: { groupId: assignment.targetId },
        });
        const ids = members.map((m) => m.studentId);
        if (ids.length === 0) return [];
        return this.students.find({ where: { id: In(ids) } });
      }
      case AssignmentTargetType.Course: {
        const enrollments = await this.enrollments.find({
          where: {
            courseTemplateId: assignment.targetId,
            status: In(['active', 'completed']),
          },
        });
        const ids = [
          ...new Set(
            enrollments
              .map((e) => e.studentId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        if (ids.length === 0) return [];
        return this.students.find({ where: { id: In(ids) } });
      }
      default:
        return [];
    }
  }

  private buildStartUrl(): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/StudentExams`;
  }
}
