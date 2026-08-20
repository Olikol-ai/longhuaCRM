/**
 * Single source of truth for school lesson-pack balance in the UI.
 *
 * School / teachers: always `students.lesson_balance`.
 * Tutor notebook API responses still expose `lesson_balance` on the contact DTO,
 * but that value is loaded from `tutor_contact_balances`, not from
 * teacher_student_contacts (column removed).
 *
 * Balance may be negative (debt for lessons taken before payment).
 *
 * Display rule (CRM-wide):
 * - positive (> 0) → green
 * - zero (0) → neutral
 * - negative (< 0) → red (debt)
 */

/**
 * @param {unknown} row Student API record or any object that carries lesson balance
 * @returns {number} integer balance (0 if missing/invalid)
 */
export function getLessonBalance(row) {
  if (!row || typeof row !== 'object') return 0;
  const raw =
    row.lesson_balance !== undefined && row.lesson_balance !== null
      ? row.lesson_balance
      : row.lessonBalance;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/**
 * Visual tone for balance — only three business states.
 * @param {number|null|undefined} balance
 * @returns {'positive'|'zero'|'debt'|'unknown'}
 */
export function lessonBalanceTone(balance) {
  if (balance === null || balance === undefined || !Number.isFinite(Number(balance))) {
    return 'unknown';
  }
  const n = Math.trunc(Number(balance));
  if (n < 0) return 'debt';
  if (n === 0) return 'zero';
  return 'positive';
}

/**
 * Tailwind classes for inline / hero balance text.
 * @param {number|null|undefined} balance
 */
export function lessonBalanceTextClass(balance) {
  switch (lessonBalanceTone(balance)) {
    case 'debt':
      return 'text-red-600 dark:text-red-400 font-semibold';
    case 'zero':
      return 'text-muted-foreground font-medium';
    case 'positive':
      return 'text-emerald-700 dark:text-emerald-400 font-semibold';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Tailwind classes for compact badge / pill chips.
 * @param {number|null|undefined} balance
 */
export function lessonBalanceBadgeClass(balance) {
  switch (lessonBalanceTone(balance)) {
    case 'debt':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50';
    case 'zero':
      return 'bg-muted text-muted-foreground border-border';
    case 'positive':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/**
 * StatCard / dashboard color token for balance.
 * @param {number|null|undefined} balance
 * @returns {'emerald'|'muted'|'rose'}
 */
export function lessonBalanceStatColor(balance) {
  switch (lessonBalanceTone(balance)) {
    case 'debt':
      return 'rose';
    case 'positive':
      return 'emerald';
    default:
      return 'muted';
  }
}

/**
 * Human-readable balance with optional sign for credit.
 * @param {number|null|undefined} balance
 * @param {{ signed?: boolean }} [opts]
 */
export function formatLessonBalance(balance, opts = {}) {
  if (balance === null || balance === undefined || !Number.isFinite(Number(balance))) {
    return '—';
  }
  const n = Math.trunc(Number(balance));
  if (opts.signed && n > 0) return `+${n}`;
  return String(n);
}

/**
 * Resolve balance for a teacher notebook contact via linked school Student only.
 * @param {object|null|undefined} contact
 * @param {Map<string, object>|Record<string, object>|object[]} students
 * @returns {{ studentId: string|null, balance: number|null }}
 *   balance is null when there is no linked Student in the school list
 */
export function getTeacherContactLessonBalance(contact, students) {
  const studentId =
    contact?.linked_student_id || contact?.linkedStudentId || null;
  if (!studentId) {
    return { studentId: null, balance: null };
  }

  let student = null;
  if (students instanceof Map) {
    student = students.get(studentId) || null;
  } else if (Array.isArray(students)) {
    student = students.find((s) => s?.id === studentId) || null;
  } else if (students && typeof students === 'object') {
    student = students[studentId] || null;
  }

  if (!student) {
    return { studentId, balance: null };
  }
  return { studentId, balance: getLessonBalance(student) };
}
