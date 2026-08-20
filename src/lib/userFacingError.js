/**
 * Map API / auth errors to Russian user-facing text.
 * Keeps technical English out of student/teacher UI.
 * Validation (HTTP 400) messages must stay visible — never hide behind a generic fallback.
 */

const EXACT = {
  'Request failed': 'Не удалось выполнить запрос. Попробуйте ещё раз.',
  'Upload failed': 'Не удалось загрузить файл. Попробуйте ещё раз.',
  'Authentication required': 'Требуется вход в систему.',
  'Account is blocked': 'Аккаунт заблокирован. Обратитесь к администратору.',
  'Invalid session role': 'Сессия недействительна. Войдите снова.',
  Unauthorized: 'Требуется вход в систему.',
  Forbidden: 'Недостаточно прав для этого действия.',
  'Not Found': 'Данные не найдены.',
  'Internal Server Error': 'Временная ошибка сервера. Попробуйте позже.',
  'Bad Request': 'Проверьте введённые данные и попробуйте снова.',
};

const PATTERNS = [
  [/credential|password|invalid email or password|wrong password/i, 'Неверный email или пароль.'],
  [/email.*(taken|exists|already)/i, 'Этот email уже зарегистрирован.'],
  [/too many|rate limit|throttl/i, 'Слишком много попыток. Подождите немного.'],
  [/network|failed to fetch|load failed/i, 'Проблема с сетью. Проверьте интернет и попробуйте снова.'],
  [/timeout/i, 'Сервер не ответил вовремя. Попробуйте ещё раз.'],
  [/jwt|token|expired/i, 'Сессия истекла. Войдите снова.'],
  [/forbidden|access denied/i, 'Недостаточно прав для этого действия.'],
  [/not found/i, 'Данные не найдены.'],
  [
    /telegram.*(not configured|unavailable|bot_username|BOT_USERNAME)/i,
    'Интеграция Telegram временно недоступна. Обратитесь к администратору.',
  ],
  [
    /lessonBalance must not be less than 0|lesson_balance must not be less than 0/i,
    'Баланс занятий не может быть меньше 0 (устаревшее ограничение сервера — обновите API).',
  ],
  [
    /lessonBalance must be an integer number|lesson_balance must be an integer number/i,
    'Баланс занятий должен быть целым числом.',
  ],
  [/must be an integer number/i, 'Значение должно быть целым числом.'],
  [/must be a number/i, 'Значение должно быть числом.'],
  [/must be an email/i, 'Укажите корректный email.'],
  [/must be a UUID/i, 'Некорректный идентификатор.'],
  [/should not be empty/i, 'Поле не должно быть пустым.'],
];

function looksTechnicalEnglish(text) {
  if (!text) return true;
  // Cyrillic present → likely already localized
  if (/[а-яёА-ЯЁ]/.test(text)) return false;
  // Pure English / tech jargon
  return /[A-Za-z]/.test(text);
}

/**
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function userFacingError(err, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  const raw =
    (typeof err === 'string' && err) ||
    (err && typeof err.message === 'string' && err.message) ||
    '';
  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;

  // Prefer already-localized API messages (e.g. video join window) over generic 403 text.
  if (/[а-яёА-ЯЁ]/.test(trimmed) && !EXACT[trimmed]) {
    return trimmed;
  }

  if (EXACT[trimmed]) return EXACT[trimmed];

  for (const [re, msg] of PATTERNS) {
    if (re.test(trimmed)) return msg;
  }

  if (err?.status === 401) return 'Требуется вход в систему.';
  if (err?.status === 403) return 'Недостаточно прав для этого действия.';
  if (err?.status === 404) return 'Данные не найдены.';
  if (err?.status >= 500) return 'Временная ошибка сервера. Попробуйте позже.';

  // Validation / business 400: show detail instead of swallowing English messages.
  if (err?.status === 400) {
    if (looksTechnicalEnglish(trimmed)) {
      return `Проверьте данные: ${trimmed}`;
    }
    return trimmed;
  }

  if (looksTechnicalEnglish(trimmed)) return fallback;

  return trimmed;
}
