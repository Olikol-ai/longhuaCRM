const BRAND_COLOR = '#4f46e5';
const BRAND_NAME = 'Longhua Chinese';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${BRAND_COLOR};padding:28px 32px;text-align:center;">
              <div style="width:48px;height:48px;margin:0 auto 12px;background:rgba(255,255,255,0.2);border-radius:12px;line-height:48px;font-size:24px;">📚</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${BRAND_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ${BRAND_NAME}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verificationCodeEmail(code: string): { subject: string; text: string; html: string } {
  const subject = `Подтверждение регистрации — ${BRAND_NAME}`;
  const text = [
    'Здравствуйте!',
    '',
    'Ваш код подтверждения:',
    '',
    code,
    '',
    'Код действителен 15 минут.',
    'Никому не сообщайте этот код.',
    '',
    `Если вы не регистрировались в ${BRAND_NAME}, проигнорируйте это письмо.`,
  ].join('\n');

  const html = layout(`
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Здравствуйте!</p>
    <p style="margin:0 0 8px;font-size:15px;color:#334155;line-height:1.6;font-weight:600;">Ваш код подтверждения:</p>
    <div style="background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;font-size:36px;font-weight:700;color:${BRAND_COLOR};letter-spacing:8px;font-family:monospace;">${code}</p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6;">
      Код действителен <strong>15 минут</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:13px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;line-height:1.5;">
      ⚠️ Никому не сообщайте этот код. Сотрудники ${BRAND_NAME} никогда не запрашивают его.
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
      Если вы не регистрировались в ${BRAND_NAME}, проигнорируйте это письмо.
    </p>
  `);

  return { subject, text, html };
}

export function smtpTestEmail(): { subject: string; text: string; html: string } {
  const subject = `${BRAND_NAME} — Проверка отправки почты`;
  const text = [
    'Поздравляем!',
    '',
    'Если вы получили это письмо — SMTP Яндекса успешно настроен.',
  ].join('\n');

  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;font-weight:700;">Поздравляем!</h2>
    <div style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1px solid #6ee7b7;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="margin:0;font-size:16px;color:#065f46;line-height:1.6;font-weight:500;">
        Если вы получили это письмо — SMTP Яндекса успешно настроен.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">
      Это тестовое письмо отправлено из Longhua CRM для проверки почтовой конфигурации.
    </p>
  `);

  return { subject, text, html };
}
