import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
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
  ) {}

  /**
   * Fire-and-forget congratulation after a certificate is successfully issued.
   * Never throws to the caller — issuing must succeed even if notify fails.
   */
  notifyIssued(certificate: CertificateEntity): void {
    void this.notifyIssuedSafe(certificate);
  }

  private async notifyIssuedSafe(certificate: CertificateEntity): Promise<void> {
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

      const studentName =
        student.name?.trim() ||
        [student.lastName, student.firstName].filter(Boolean).join(' ').trim() ||
        'ученик';
      const courseName = course?.name?.trim() || 'курс';
      const series = certificate.blankSeries || '—';
      const number = certificate.blankNumber || '—';
      const issueDate = certificate.issueDate || '—';
      const viewUrl = this.buildCertificateUrl(certificate.id);

      const title = '🎉 Новое достижение разблокировано!';
      const body = [
        `Поздравляем, ${studentName}! 🏆`,
        '',
        'Ты успешно завершил курс:',
        `📚 ${courseName}`,
        '',
        'и получил сертификат школы Longhua Chinese.',
        '',
        'Твой результат подтвержден.',
        `Серия: ${series}`,
        `Номер: ${number}`,
        `Дата выдачи: ${issueDate}`,
        '',
        'Продолжай развиваться и открывай новые уровни китайского языка! 🐉',
      ].join('\n');

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

      const telegramId = student.telegramId?.trim();
      if (telegramId) {
        const tgBody = `${title}\n\n${body}`;
        const sent = await this.telegram.sendMessage(telegramId, tgBody, {
          replyMarkup: {
            inline_keyboard: [[{ text: 'Посмотреть сертификат', url: viewUrl }]],
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
