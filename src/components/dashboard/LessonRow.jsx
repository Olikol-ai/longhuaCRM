import { Clock, Video } from "lucide-react";

const statusStyles = {
  planned: "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900/50",
  completed: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50",
  cancelled: "bg-red-50 text-red-500 border-red-100 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50",
  rescheduled: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50",
};

export default function LessonRow({ lesson, role = "admin", onAction }) {
  const getDisplayName = (firstName, lastName, fallback) => {
    if (firstName && lastName) return `${lastName} ${firstName}`;
    return fallback || "Unknown";
  };

  const studentDisplay = getDisplayName(
    lesson.student_first_name,
    lesson.student_last_name,
    lesson.student_name
  );
  const teacherDisplay = getDisplayName(
    lesson.teacher_first_name,
    lesson.teacher_last_name,
    lesson.teacher_name
  );

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="w-1 h-10 rounded-full bg-indigo-400 dark:bg-indigo-500 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {role === "teacher" ? studentDisplay : role === "student" ? teacherDisplay : `${studentDisplay} → ${teacherDisplay}`}
          </span>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${statusStyles[lesson.status] || statusStyles.planned}`}>
            {lesson.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {lesson.start_time} · {lesson.duration || 60}min
          </span>
          {lesson.meeting_link && (
            <a
              href={lesson.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              onClick={(e) => e.stopPropagation()}
            >
              <Video className="w-3 h-3" /> Join
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
