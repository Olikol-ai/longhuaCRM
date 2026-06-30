import { Clock, User, GraduationCap, Video, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const statusStyles = {
  planned: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50",
  cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50",
  rescheduled: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50",
};

export default function LessonCard({ lesson, showTeacher = true, showStudent = true, onClick }) {
  return (
    <Card
      className="p-4 hover:shadow-sm transition-all cursor-pointer group"
      onClick={() => onClick?.(lesson)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          <span className="text-sm font-semibold text-foreground">{lesson.start_time}</span>
          <span className="text-xs text-muted-foreground">{lesson.duration || 60} min</span>
        </div>
        <Badge variant="outline" className={`text-[11px] ${statusStyles[lesson.status] || statusStyles.planned}`}>
          {lesson.status}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {showStudent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{lesson.student_name || "—"}</span>
          </div>
        )}
        {showTeacher && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{lesson.teacher_name || "—"}</span>
          </div>
        )}
      </div>

      {lesson.meeting_link && (
        <a
          href={lesson.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
        >
          <Video className="h-3.5 w-3.5" />
          Join Meeting
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </Card>
  );
}
