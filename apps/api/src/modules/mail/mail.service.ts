import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  formatMailConfigError,
  formatSmtpDiagnosticLog,
  isMailConfigured,
  type MailEnvConfig,
} from '../../config/mail-config';
import { getEmailDomain, TEST_EMAIL_DOMAIN } from '../../common/security/email-validation';
import { passwordResetEmail, smtpTestEmail, verificationCodeEmail } from './mail.templates';

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
    const mail = this.getMailConfig();
    this.logger.log(formatSmtpDiagnosticLog(mail));

    if (!this.isConfigured()) {
      this.logger.warn(formatMailConfigError(mail));
      return;
    }

    try {
      await this.ensureVerified();
    } catch {
      // ensureVerified already logs the full error
    }
  }

  private getMailConfig(): MailEnvConfig {
    return {
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port') ?? 465,
      secure: this.config.get<boolean>('mail.secure') ?? true,
      user: this.config.get<string>('mail.user'),
      pass: this.config.get<string>('mail.pass') ?? '',
      from: this.config.get<string>('mail.from'),
    };
  }

  isConfigured(): boolean {
    return isMailConfigured(this.getMailConfig());
  }

  getConfigurationError(): string {
    return formatMailConfigError(this.getMailConfig());
  }

  async sendVerificationCode(to: string, code: string): Promise<MailSendResult> {
    const domain = getEmailDomain(to);
    if (
      process.env.E2E_STUB_MAIL === 'true'
      && domain
      && domain !== TEST_EMAIL_DOMAIN
    ) {
      this.logger.log(`[E2E_STUB_MAIL] verification code for ${to}: ${code}`);
      return { sent: true, status: 'sent' };
    }

    if (!this.isConfigured()) {
      const error = this.getConfigurationError();
      this.logger.warn(`[verification] ${error} — email to ${to} was not sent`);
      return { sent: false, status: 'email_not_sent', error };
    }

    const template = verificationCodeEmail(code);
    return this.sendMail(to, template.subject, template.text, template.html, 'verification');
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<MailSendResult> {
    const domain = getEmailDomain(to);
    if (
      process.env.E2E_STUB_MAIL === 'true'
      && domain
      && domain !== TEST_EMAIL_DOMAIN
    ) {
      this.logger.log(`[E2E_STUB_MAIL] password reset link for ${to}: ${resetUrl}`);
      return { sent: true, status: 'sent' };
    }

    if (!this.isConfigured()) {
      const error = this.getConfigurationError();
      this.logger.warn(`[password-reset] ${error} — email to ${to} was not sent`);
      return { sent: false, status: 'email_not_sent', error };
    }

    const template = passwordResetEmail(resetUrl);
    return this.sendMail(to, template.subject, template.text, template.html, 'password-reset');
  }

  async sendTestEmail(to: string): Promise<MailTestResult> {
    if (!this.isConfigured()) {
      const error = this.getConfigurationError();
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
      const mail = this.getMailConfig();

      this.logger.log(
        `Creating SMTP transporter: host=${mail.host} port=${mail.port} secure=${mail.secure} user=${mail.user}`,
      );

      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: { user: mail.user, pass: mail.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
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
