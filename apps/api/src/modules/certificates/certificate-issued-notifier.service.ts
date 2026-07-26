import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { formatStudentProfileDisplayName } from '../users/display-name.util';
import { UserEntity } from '../users/entities/user.entity';
import { CertificateEntity } from './entities/certificate.entity';

@Injectable()
export class CertificateIssuedNotifier {
  private readonly logger = new Logger(CertificateIssuedNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Fire-and-forget congratulation after a certificate is successfully issued.
   * Never throws to the caller — issuing must succeed even if notify fails.
   */
  notifyIssued(certificate: CertificateEntity): void {
    void this.notifyIssuedSafe(certificate, 'course');
  }

  /**
   * Congratulation after Assessment Result → Certificate.
   */
  notifyAssessmentIssued(
    certificate: CertificateEntity,
    meta: { examName?: string | null } = {},
  ): void {
    void this.notifyIssuedSafe(certificate, 'assessment', meta);
  }

  private async notifyIssuedSafe(
    certificate: CertificateEntity,
    kind: 'course' | 'assessment',
    meta: { examName?: string | null } = {},
  ): Promise<void> {
    try {
      if (!certificate.studentId) {
        return;
      }

      const [student, course] = await Promise.all([
        this.studentRepo.findOne({ where: { id: certificate.studentId } }),
        this.courseRepo.findOne({ where: { id: certificate.courseId } }),
      ]);

      if (!student?.userId) {
        this.logger.warn(
          `Skip certificate notification: student ${certificate.studentId} has no user account`,
        );
        return;
      }

      const linkedUser = await this.userRepo.findOne({ where: { id: student.userId } });
      const telegramId =
        linkedUser?.telegramId?.trim() || student.telegramId?.trim() || '';

      const studentName =
        formatStudentProfileDisplayName(student) || 'ученик';
      const courseName = course?.name?.trim() || 'курс';
      const series = certificate.blankSeries || '—';
      const number = certificate.blankNumber || '—';
      const issueDate = certificate.issueDate || '—';
      const viewUrl = this.buildCertificateUrl(certificate.id);

      let title: string;
      let body: string;
      let buttonText: string;

      if (kind === 'assessment') {
        title = '🎉 Поздравляем!';
        body = [
          'Вы успешно завершили экзамен.',
          meta.examName ? `Экзамен: ${meta.examName}` : null,
          '',
          'Ваш сертификат Longhua Academy готов.',
          '',
          `Курс: ${courseName}`,
          `Серия: ${series}`,
          `Номер: ${number}`,
          `Дата выдачи: ${issueDate}`,
        ]
          .filter((line) => line !== null)
          .join('\n');
        buttonText = 'Открыть сертификат';
      } else {
        title = '🎉 Новое достижение разблокировано!';
        body = [
          `Поздравляем, ${studentName}! 🏆`,
          '',
          'Ты успешно завершил курс:',
          `📚 ${courseName}`,
          '',
          'и получил сертификат Longhua Academy.',
          '',
          'Твой результат подтвержден.',
          `Серия: ${series}`,
          `Номер: ${number}`,
          `Дата выдачи: ${issueDate}`,
          '',
          'Продолжай развиваться и открывай новые уровни китайского языка! 🐉',
        ].join('\n');
        buttonText = 'Посмотреть сертификат';
      }

      await this.notifications.create({
        userId: student.userId,
        channel: 'in_app',
        type: 'certificate_issued',
        title,
        body,
        status: 'pending',
        referenceType: 'certificate',
        referenceId: certificate.id,
      });

      if (telegramId) {
        const tgBody = `${title}\n\n${body}`;
        const sent = await this.telegram.sendMessage(telegramId, tgBody, {
          replyMarkup: {
            inline_keyboard: [[{ text: buttonText, url: viewUrl }]],
          },
        });
        await this.notifications.create({
          userId: student.userId,
          channel: 'telegram',
          type: 'certificate_issued',
          title,
          body,
          status: sent.ok ? 'sent' : 'failed',
          referenceType: 'certificate',
          referenceId: certificate.id,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to notify student about certificate ${certificate.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private buildCertificateUrl(certificateId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/certificate/${certificateId}`;
  }
}
