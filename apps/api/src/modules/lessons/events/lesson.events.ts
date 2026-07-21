export const LESSON_RESCHEDULED = 'lesson.rescheduled';
export const LESSON_UPDATED = 'lesson.updated';

export type LessonRescheduledPayload = {
  lessonId: string;
  teacherId: string | null;
  actorUserId: string | null;
  teacherDisplayName: string | null;
  previous: {
    date: string;
    startTime: string;
    duration: number;
  };
  next: {
    date: string;
    startTime: string;
    duration: number;
  };
  /** Students who had already confirmed before the reschedule. */
  confirmedStudentIds: string[];
};

export type LessonUpdatedChangedField = {
  field: 'notes' | 'meetingLink' | 'room';
  label: string;
  previous: string | null;
  next: string | null;
};

export type LessonUpdatedPayload = {
  lessonId: string;
  teacherId: string | null;
  actorUserId: string | null;
  teacherDisplayName: string | null;
  changedFields: LessonUpdatedChangedField[];
  studentIds: string[];
};
