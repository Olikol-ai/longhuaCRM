/**
 * Hierarchical parent map for HSK Academy / Exam Content (not browser history).
 * Returns null for module roots (no Back button).
 */
export function parentOf(pageName, searchParams = null) {
  const from =
    typeof searchParams?.get === 'function'
      ? searchParams.get('from')
      : searchParams?.from || null;

  switch (pageName) {
    case 'HskAcademy':
      return null;
    case 'HskAcademyPractice':
    case 'HskAcademyMock':
    case 'HskAcademyPreparation':
      return { page: 'HskAcademy', label: 'Обзор' };
    case 'HskAcademyResult':
      if (from === 'practice') return { page: 'HskAcademyPractice', label: 'Тренировка' };
      if (from === 'mock') return { page: 'HskAcademyMock', label: 'Пробный экзамен' };
      return { page: 'HskAcademyPreparation', label: 'Моя подготовка' };
    case 'HskAcademyTake':
      if (from === 'practice') return { page: 'HskAcademyPractice', label: 'Тренировка' };
      if (from === 'mock') return { page: 'HskAcademyMock', label: 'Пробный экзамен' };
      if (from === 'prep') return { page: 'HskAcademyPreparation', label: 'Моя подготовка' };
      return { page: 'HskAcademy', label: 'Обзор' };
    case 'ExamContent':
      return { page: 'HskAcademy', label: 'HSK Academy' };
    case 'ExamContentBank':
    case 'ExamContentMedia':
    case 'ExamContentExams':
    case 'ExamContentOps':
      return { page: 'ExamContent', label: 'Студия HSK' };
    default:
      return null;
  }
}

function pagePath(pageName) {
  return `/${pageName}`;
}

export function parentHref(pageName, searchParams = null) {
  const parent = parentOf(pageName, searchParams);
  if (!parent) return null;
  return pagePath(parent.page);
}

/** Build Take URL with session and optional from= for Back/exit. */
export function takeHref(sessionId, from) {
  const q = new URLSearchParams();
  if (sessionId) q.set('sessionId', sessionId);
  if (from) q.set('from', from);
  const s = q.toString();
  return s ? `${pagePath('HskAcademyTake')}?${s}` : pagePath('HskAcademyTake');
}

export function resultHref(sessionId, from) {
  const q = new URLSearchParams();
  if (sessionId) q.set('sessionId', sessionId);
  if (from) q.set('from', from);
  const s = q.toString();
  return s ? `${pagePath('HskAcademyResult')}?${s}` : pagePath('HskAcademyResult');
}
