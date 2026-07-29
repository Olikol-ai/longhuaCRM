import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { TelegramService } from '../../telegram/telegram.service';
import { UserEntity } from '../../users/entities/user.entity';
import { HomeworkAssignmentEntity } from '../entities/homework-assignment.entity';
import { HomeworkEntity } from '../entities/homework.entity';
import { HomeworkResultEntity } from '../entities/homework-result.entity';

interface HomeworkNotificationRecipient {
  userId: string | null;
  displayName: string;
}

@Injectable()
export class HomeworkNotifierService {
  private readonly logger = new Logger(HomeworkNotifierService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  notifyAssigned(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
  ): void {
    void this.notifyAssignedSafe(assignment, homework, learner);
  }

  notifySubmitted(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
    result: HomeworkResultEntity,
  ): void {
    void this.notifySubmittedSafe(assignment, homework, learner, result);
  }

  notifyReviewed(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
    result: HomeworkResultEntity,
  ): void {
    void this.notifyReviewedSafe(assignment, homework, learner, result);
  }

  private appBaseUrl(): string {
    return (
      this.config.get<string>('APP_PUBLIC_URL') ||
      this.config.get<string>('PUBLIC_APP_URL') ||
      'https://crm.longhua.academy'
    ).replace(/\/$/, '');
  }

  private async notifyAssignedSafe(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
  ): Promise<void> {
    try {
      if (!learner.userId) return;
      const title = 'Новое домашнее задание';
      const body = `Вам назначено домашнее задание «${homework.title}».`;
      const link = `${this.appBaseUrl()}/HomeworkViewer?assignmentId=${assignment.id}`;

      await this.notifications.create({
        userId: learner.userId,
        channel: 'in_app',
        type: 'homework_assigned',
        title,
        body,
        status: 'sent',
        referenceType: 'homework_assignment',
        referenceId: assignment.id,
      });

      const user = await this.users.findOne({ where: { id: learner.userId } });
      if (user?.telegramId) {
        await this.telegram.sendMessage(
          user.telegramId,
          `${title}\n\n${body}\n\nОткрыть: ${link}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed homework assigned notify: ${(err as Error).message}`,
      );
    }
  }

  private async notifySubmittedSafe(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
    result: HomeworkResultEntity,
  ): Promise<void> {
    try {
      const teacherUserId = assignment.assignedByUserId;
      const studentName = learner.displayName;
      const title = 'Домашнее задание выполнено';
      const body = `Ученик ${studentName} выполнил домашнее задание «${homework.title}».`;
      const link = `${this.appBaseUrl()}/HomeworkResults?assignmentId=${assignment.id}`;

      await this.notifications.create({
        userId: teacherUserId,
        channel: 'in_app',
        type: 'homework_submitted',
        title,
        body: `${body} Результат: ${result.percent}%`,
        status: 'sent',
        referenceType: 'homework_assignment',
        referenceId: assignment.id,
      });

      const user = await this.users.findOne({ where: { id: teacherUserId } });
      if (user?.telegramId) {
        await this.telegram.sendMessage(
          user.telegramId,
          `${title}\n\n${body}\nБаллы: ${result.score}/${result.maxScore} (${result.percent}%)\n\nОткрыть: ${link}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed homework submitted notify: ${(err as Error).message}`,
      );
    }
  }

  private async notifyReviewedSafe(
    assignment: HomeworkAssignmentEntity,
    homework: HomeworkEntity,
    learner: HomeworkNotificationRecipient,
    result: HomeworkResultEntity,
  ): Promise<void> {
    try {
      if (!learner.userId) return;
      const title = 'Домашнее задание проверено';
      const body = `Домашнее задание «${homework.title}» проверено. Результат: ${result.percent}%.`;
      const link = `${this.appBaseUrl()}/HomeworkViewer?assignmentId=${assignment.id}`;

      await this.notifications.create({
        userId: learner.userId,
        channel: 'in_app',
        type: 'homework_reviewed',
        title,
        body,
        status: 'sent',
        referenceType: 'homework_assignment',
        referenceId: assignment.id,
      });

      const user = await this.users.findOne({ where: { id: learner.userId } });
      if (user?.telegramId) {
        await this.telegram.sendMessage(
          user.telegramId,
          `${title}\n\n${body}\n\nОткрыть: ${link}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed homework reviewed notify: ${(err as Error).message}`,
      );
    }
  }
}
