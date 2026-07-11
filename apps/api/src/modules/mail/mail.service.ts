import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { smtpTestEmail, verificationCodeEmail } from './mail.templates';

export type MailSendResult = {
  sent: boolean;
  status: 'sent' | 'email_not_sent';
  error?: string;
};

export type MailTestResult = {
  success: boolean;
  error?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private verifyPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Mail SMTP is not configured — set MAIL_HOST, MAIL_USER and MAIL_PASS in .env',
      );
      return;
    }

    try {
      await this.ensureVerified();
    } catch {
      // ensureVerified already logs the full error
    }
  }

  isConfigured(): boolean {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    return Boolean(host && user && pass);
  }

  async sendVerificationCode(to: string, code: string): Promise<MailSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `[verification] SMTP not configured — email to ${to} was not sent`,
      );
      return { sent: false, status: 'email_not_sent', error: 'SMTP not configured' };
    }

    const template = verificationCodeEmail(code);
    return this.sendMail(to, template.subject, template.text, template.html, 'verification');
  }

  async sendTestEmail(to: string): Promise<MailTestResult> {
    if (!this.isConfigured()) {
      const error = 'SMTP not configured (MAIL_HOST, MAIL_USER, MAIL_PASS required)';
      this.logger.error(`[test] ${error}`);
      return { success: false, error };
    }

    const template = smtpTestEmail();
    const result = await this.sendMail(
      to,
      template.subject,
      template.text,
      template.html,
      'test',
    );

    if (result.sent) {
      return { success: true };
    }

    return { success: false, error: result.error ?? 'Unknown SMTP error' };
  }

  private async sendMail(
    to: string,
    subject: string,
    text: string,
    html: string,
    context: string,
  ): Promise<MailSendResult> {
    const from = this.getFromAddress();

    try {
      await this.ensureVerified();
      const info = await this.getTransporter().sendMail({ from, to, subject, text, html });
      if (context === 'verification') {
        this.logger.log(`Verification email sent to ${to}`);
      } else {
        this.logger.log(
          `[${context}] Email sent to ${to} (messageId=${info.messageId ?? 'n/a'})`,
        );
      }
      return { sent: true, status: 'sent' };
    } catch (error) {
      const errorMessage = this.logMailError(context, error);
      return { sent: false, status: 'email_not_sent', error: errorMessage };
    }
  }

  private async ensureVerified(): Promise<void> {
    if (!this.verifyPromise) {
      this.verifyPromise = this.getTransporter()
        .verify()
        .then(() => {
          this.logger.log('SMTP connection established');
        })
        .catch((error) => {
          this.verifyPromise = null;
          this.logMailError('SMTP verify', error);
          throw error;
        });
    }

    await this.verifyPromise;
  }

  private getFromAddress(): string {
    return (
      this.config.get<string>('mail.from') ??
      this.config.get<string>('mail.user') ??
      'Longhua Chinese <noreply@localhost>'
    );
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host = this.config.get<string>('mail.host');
      const port = this.config.get<number>('mail.port');
      const secure = this.config.get<boolean>('mail.secure');
      const user = this.config.get<string>('mail.user');
      const pass = this.config.get<string>('mail.pass');

      this.logger.log(
        `Creating SMTP transporter: host=${host} port=${port} secure=${secure} user=${user}`,
      );

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    }

    return this.transporter;
  }

  private logMailError(context: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`[${context}] ${message}`);
    if (stack) {
      this.logger.error(stack);
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const smtpResponse = (error as { response?: string }).response;
      if (smtpResponse) {
        this.logger.error(`[${context}] SMTP response: ${smtpResponse}`);
      }
    }

    if (error && typeof error === 'object' && 'responseCode' in error) {
      const code = (error as { responseCode?: number }).responseCode;
      if (code != null) {
        this.logger.error(`[${context}] SMTP responseCode: ${code}`);
      }
    }

    console.error(`[MailService:${context}]`, error);

    return stack ? `${message}\n${stack}` : message;
  }
}
