/**
 * Stage 4 — unified platform event taxonomy (business facts).
 * Payload is non-authoritative template data only.
 */

export type PlatformEventType =
  | 'message.received'
  | 'lesson.created'
  | 'lesson.updated'
  | 'lesson.rescheduled'
  | 'lesson.cancelled'
  | 'lesson.reminder'
  | 'lesson.tomorrow'
  | 'homework.created'
  | 'homework.updated'
  | 'homework.assigned'
  | 'homework.submitted'
  | 'homework.graded'
  | 'homework.deadline'
  | 'material.shared'
  | 'material.updated'
  | 'payment.created'
  | 'payment.updated'
  | 'certificate.issued'
  | 'certificate.revoked'
  | 'exam.created'
  | 'exam.assigned'
  | 'exam.result'
  | 'system.announcement';

export type NotificationCategory =
  | 'messages'
  | 'lessons'
  | 'homework'
  | 'materials'
  | 'payments'
  | 'certificates'
  | 'exams'
  | 'system';

export interface PlatformEvent {
  eventId: string;
  eventType: PlatformEventType;
  occurredAt: string;
  actorId: string | null;
  recipientIds: string[];
  entityType: string;
  entityId: string;
  payload: Record<string, string | number | boolean | null>;
  version: number;
}

export function categoryForEvent(eventType: PlatformEventType): NotificationCategory {
  if (eventType.startsWith('message.')) return 'messages';
  if (eventType.startsWith('lesson.')) return 'lessons';
  if (eventType.startsWith('homework.')) return 'homework';
  if (eventType.startsWith('material.')) return 'materials';
  if (eventType.startsWith('payment.')) return 'payments';
  if (eventType.startsWith('certificate.')) return 'certificates';
  if (eventType.startsWith('exam.')) return 'exams';
  return 'system';
}

/** Map legacy notifier type strings → catalog. */
export function normalizeLegacyNotificationType(type: string): PlatformEventType | null {
  const map: Record<string, PlatformEventType> = {
    chat_message: 'message.received',
    lesson_rescheduled: 'lesson.rescheduled',
    lesson_updated: 'lesson.updated',
    homework_assigned: 'homework.assigned',
    homework_submitted: 'homework.submitted',
    homework_reviewed: 'homework.graded',
    certificate_issued: 'certificate.issued',
  };
  return map[type] || null;
}
