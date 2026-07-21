import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';
import nodemailer from 'nodemailer';
import {
  formatMailConfigError,
  formatSmtpDiagnosticLog,
  isMailConfigured,
  readMailEnvFromProcess,
} from '../src/config/mail-config';
import { smtpTestEmail } from '../src/modules/mail/mail.templates';

function loadEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
    join(__dirname, '../../../.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
      console.log(`Loaded env from ${path}`);
      return;
    }
  }
  loadDotenv();
}

async function main(): Promise<void> {
  const to = process.argv[2]?.trim() || 'ilyayanchilenko@gmail.com';
  loadEnv();

  const mail = readMailEnvFromProcess();
  console.log(formatSmtpDiagnosticLog(mail));

  if (!isMailConfigured(mail)) {
    console.error(formatMailConfigError(mail));
    process.exit(1);
  }

  const template = smtpTestEmail();
  const transporter = nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: { user: mail.user, pass: mail.pass },
  });

  await transporter.verify();
  console.log('SMTP connection established');

  const from = mail.from ?? mail.user ?? 'Longhua Academy <noreply@localhost>';
  const info = await transporter.sendMail({
    from,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  console.log(`Email sent to ${to} (messageId=${info.messageId ?? 'n/a'})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
