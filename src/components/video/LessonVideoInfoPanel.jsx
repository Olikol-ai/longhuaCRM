import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

/**
 * Lesson info — modal only, never a permanent side tab.
 */
export default function LessonVideoInfoPanel({
  lesson,
  subject = '',
  timeRange = '',
  connectionLabel = '',
  isHost = false,
  homeworkPath,
  onRequestNavigate,
  onCompleteLesson,
  completeBusy = false,
}) {
  return (
    <div className="space-y-3 text-xs text-foreground" data-testid="lesson-video-info">
      <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3">
        <p>
          <span className="text-muted-foreground">Урок:</span>{' '}
          <span className="font-medium">{lesson?.title || 'Онлайн-урок'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Предмет:</span> {subject || '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Преподаватель:</span>{' '}
          {lesson?.teacher_name || '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Время:</span> {timeRange || '—'}
        </p>
        {connectionLabel ? (
          <p>
            <span className="text-muted-foreground">Статус:</span> {connectionLabel}
          </p>
        ) : null}
        {lesson?.group_name ? (
          <p>
            <span className="text-muted-foreground">Группа:</span> {lesson.group_name}
          </p>
        ) : null}
      </div>
      {isHost ? (
        <div className="space-y-2">
          <p className="text-muted-foreground">Действия преподавателя</p>
          <Button
            type="button"
            className="w-full min-h-11"
            disabled={completeBusy}
            onClick={() => onCompleteLesson?.()}
          >
            Отметить урок завершённым
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11"
            onClick={() => onRequestNavigate?.(homeworkPath, 'домашние задания')}
          >
            <ChevronRight className="mr-2 h-4 w-4" />
            Назначить домашнее задание
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-11"
            onClick={() =>
              onRequestNavigate?.(createPageUrl('TeacherSchedule'), 'расписание')
            }
          >
            <ChevronRight className="mr-2 h-4 w-4" />
            К расписанию
          </Button>
        </div>
      ) : null}
    </div>
  );
}
