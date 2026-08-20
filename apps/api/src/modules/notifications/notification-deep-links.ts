import { PlatformEventType } from './platform-event.types';

export type DeepLinkRole =
  | 'admin'
  | 'teacher'
  | 'tutor'
  | 'student'
  | 'tutor_student'
  | string
  | null
  | undefined;

/**
 * Role-aware deep link SSOT for notifications.
 * Push is not ACL — RoleRouteGuard still applies after open.
 * Deep link only suggests a route; API/ACL finally authorize access.
 */
export function resolveNotificationDeepLink(input: {
  eventType: PlatformEventType | string;
  role?: DeepLinkRole;
  referenceType?: string | null;
  referenceId?: string | null;
  payload?: Record<string, string | number | boolean | null>;
}): string {
  const type = String(input.eventType || '');
  const role = String(input.role || '');
  const refId = input.referenceId ? String(input.referenceId) : '';
  const chatId = String(input.payload?.chatId || refId || '');
  const assignmentId = String(input.payload?.assignmentId || refId || '');
  const lessonId = String(input.payload?.lessonId || refId || '');
  const certificateId = String(input.payload?.certificateId || refId || '');

  if (type === 'message.received' || type === 'chat_message') {
    return chatId ? `/Chats?chatId=${encodeURIComponent(chatId)}` : '/Chats';
  }

  if (type.startsWith('lesson.') || type.startsWith('lesson_')) {
    if (role === 'admin') {
      return lessonId ? `/Schedule?lesson=${encodeURIComponent(lessonId)}` : '/Schedule';
    }
    if (role === 'teacher') {
      return lessonId
        ? `/TeacherSchedule?lesson=${encodeURIComponent(lessonId)}`
        : '/TeacherSchedule';
    }
    if (role === 'tutor') {
      return lessonId
        ? `/TutorSchedule?lesson=${encodeURIComponent(lessonId)}`
        : '/TutorSchedule';
    }
    return lessonId
      ? `/StudentLessons?lesson=${encodeURIComponent(lessonId)}`
      : '/StudentLessons';
  }

  if (type === 'homework.assigned' || type === 'homework_assigned') {
    return assignmentId
      ? `/HomeworkViewer?assignmentId=${encodeURIComponent(assignmentId)}`
      : '/HomeworkViewer';
  }

  if (
    type === 'homework.submitted'
    || type === 'homework_submitted'
    || type === 'homework.graded'
    || type === 'homework_reviewed'
  ) {
    if (role === 'student' || role === 'tutor_student') {
      return assignmentId
        ? `/HomeworkViewer?assignmentId=${encodeURIComponent(assignmentId)}`
        : '/HomeworkViewer';
    }
    return '/HomeworkList';
  }

  if (type.startsWith('homework.')) {
    return role === 'student' || role === 'tutor_student'
      ? '/HomeworkViewer'
      : '/HomeworkList';
  }

  if (type.startsWith('certificate.') || type === 'certificate_issued') {
    if (role === 'student') {
      return certificateId
        ? `/CertificateView/${encodeURIComponent(certificateId)}`
        : '/StudentCertificates';
    }
    if (role === 'admin') return '/Certificates';
    return '/StudentCertificates';
  }

  if (type.startsWith('exam.') || type.startsWith('assessment')) {
    if (role === 'student') return '/StudentExams';
    if (role === 'teacher' || role === 'tutor') return '/TeacherAssessment';
    return '/AdminAssessment';
  }

  if (type.startsWith('payment.')) {
    if (role === 'student') return '/StudentDashboard';
    return '/Payments';
  }

  if (type.startsWith('material.')) {
    if (role === 'student' || role === 'tutor_student') {
      return '/StudentLessonMaterials';
    }
    return '/MaterialsHub';
  }

  return '/';
}
