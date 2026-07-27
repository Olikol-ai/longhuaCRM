import { Clock, Video } from "lucide-react";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { resolveLessonStudentLabel } from "@/lib/studentLabels";
import { localizeLessonStatus } from "@/lib/locale-by";

const statusStyles = {
  planned: "bg-brand-soft text-brand border-brand/20 dark:bg-brand-soft/50 dark:text-brand dark:border-brand/40",
  completed: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50",
  cancelled: "bg-red-50 text-red-500 border-red-100 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50",
  rescheduled: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50",
  missed: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900/50",
  missed_no_notice: "bg-red-50 text-red-500 border-red-100 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50",
};

/**
 * @param {{ lesson: object, role?: 'admin'|'teacher'|'student', students?: object[], teachers?: object[], onAction?: import('react').ReactNode }} props
 */
export default function LessonRow({
  lesson,
  role = "admin",
  students = [],
  teachers = [],
  onAction,
}) {
  const studentDisplay = resolveLessonStudentLabel(lesson, students);
  const teacherDisplay = resolveLessonTeacherLabel(lesson, teachers);

  const title =
    role === "teacher"
      ? studentDisplay
      : role === "student"
        ? teacherDisplay
        : `${teacherDisplay} → ${studentDisplay}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="w-1 h-10 rounded-full bg-brand dark:bg-brand flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${statusStyles[lesson.status] || statusStyles.planned}`}>
            {localizeLessonStatus(lesson.status)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {lesson.start_time} · {lesson.duration || 60} мин
          </span>
          {lesson.meeting_link && (
            <a
              href={lesson.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand dark:text-brand hover:text-brand dark:hover:text-brand"
              onClick={(e) => e.stopPropagation()}
            >
              <Video className="w-3 h-3" /> Подключиться
            </a>
          )}
        </div>
      </div>
      {onAction && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {onAction}
        </div>
      )}
    </div>
  );
}
