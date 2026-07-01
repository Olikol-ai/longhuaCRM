import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailSendResult = {
  sent: boolean;
  status: 'sent' | 'email_not_sent';
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    return Boolean(host && user && pass);
  }

  async sendVerificationCode(to: string, code: string): Promise<MailSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `[verification] SMTP not configured — code for ${to}: ${code}`,
      );
      return { sent: false, status: 'email_not_sent' };
    }

    const from = this.config.get<string>('mail.from') ?? this.config.get<string>('mail.user');
    const subject = 'Код подтверждения — Longhua Chinese';
    const text = [
      'Здравствуйте!',
      '',
      'Вы зарегистрировались в Longhua Chinese.',
      `Код подтверждения: ${code}`,
      '',
      'Введите этот код на странице подтверждения аккаунта.',
      'Если вы не регистрировались — проигнорируйте это письмо.',
    ].join('\n');
    const html = `
      <p>Здравствуйте!</p>
      <p>Вы зарегистрировались в <strong>Longhua Chinese</strong>.</p>
      <p>Код подтверждения:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Введите этот код на странице подтверждения аккаунта.</p>
      <p style="color:#666;font-size:13px;">Если вы не регистрировались — проигнорируйте это письмо.</p>
    `.trim();

    try {
      await this.getTransporter().sendMail({ from, to, subject, text, html });
      this.logger.log(`Verification email sent to ${to}`);
      return { sent: true, status: 'sent' };
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error as Error);
      this.logger.warn(`[verification] fallback log for ${to}: ${code}`);
      return { sent: false, status: 'email_not_sent' };
    }
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('mail.host'),
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<boolean>('mail.secure'),
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: this.config.get<string>('mail.pass'),
        },
      });
    }
    return this.transporter;
  }
}
