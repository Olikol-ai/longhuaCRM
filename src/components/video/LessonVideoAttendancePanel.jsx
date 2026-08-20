import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import { localizeAttendanceStatus } from '@/lib/locale-by';
import {
  mergeRosterWithPresence,
  shouldSuggestPresent,
} from '@/lib/lesson-video';

function attendanceActionLabel(status) {
  if (status === 'attended') return 'Был';
  if (status === 'missed') return 'Не был';
  if (status === 'late') return 'Опоздал';
  if (status === 'excused') return 'Уважительная причина';
  return localizeAttendanceStatus(status);
}

/**
 * Attendance marking — opens as modal/drawer, never a permanent rail tab.
 */
export default function LessonVideoAttendancePanel({
  lessonId,
  livePresence = [],
}) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const res = await api.video.getParticipants(lessonId);
      setParticipants(res.participants || res.Participants || []);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить посещаемость',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, [load]);

  const roster = useMemo(
    () => mergeRosterWithPresence(participants, livePresence),
    [participants, livePresence],
  );

  const rows = useMemo(
    () =>
      roster.filter(
        (p) => p.role === 'student' && (p.attendance_id || p.student_id),
      ),
    [roster],
  );

  const setStatus = async (attendanceId, status) => {
    if (!attendanceId || !status) return;
    setBusy(true);
    try {
      if (status === 'attended') await api.lessons.attendance.present(attendanceId);
      else if (status === 'missed') await api.lessons.attendance.absent(attendanceId);
      else if (status === 'late') await api.lessons.attendance.late(attendanceId);
      else if (status === 'excused') await api.lessons.attendance.excused(attendanceId);
      else {
        await api.lessons.attendance.update(attendanceId, {
          attendanceStatus: status,
        });
      }
      toast({ title: `Посещаемость: ${attendanceActionLabel(status)}` });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось обновить посещаемость',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="lesson-video-attendance">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Отметьте посещаемость вручную. Если ученик был в конференции достаточно
        долго, система предложит статус «Был».
      </p>
      {loading && !rows.length ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      ) : rows.length ? (
        <ul className="max-h-[min(50vh,22rem)] space-y-3 overflow-y-auto">
          {rows.map((p, idx) => {
            const status = p.attendance_status || 'enrolled';
            const suggestPresent =
              status === 'enrolled' &&
              shouldSuggestPresent(p.presence, undefined, nowTick);
            return (
              <li
                key={`${p.attendance_id || p.student_id}-${idx}`}
                className="space-y-2 rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.online ? 'онлайн' : 'офлайн'}
                    {' · '}
                    {localizeAttendanceStatus(status)}
                  </p>
                  {suggestPresent ? (
                    <p
                      className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400"
                      data-testid="attendance-suggest-present"
                    >
                      Рекомендуем: Был
                    </p>
                  ) : null}
                </div>
                {p.attendance_id ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { status: 'attended', label: 'Был', suggest: suggestPresent },
                      { status: 'missed', label: 'Не был' },
                      { status: 'late', label: 'Опоздал' },
                      { status: 'excused', label: 'Уважительная причина' },
                    ].map((btn) => {
                      const active = status === btn.status;
                      return (
                        <Button
                          key={btn.status}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          disabled={busy}
                          className={cn(
                            'min-h-10 px-2 text-[11px] leading-tight',
                            btn.suggest && !active && 'ring-1 ring-emerald-500/40',
                          )}
                          onClick={() => void setStatus(p.attendance_id, btn.status)}
                        >
                          {btn.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400/90">
                    Нет записи посещаемости
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Нет учеников для отметки посещаемости.
        </p>
      )}
    </div>
  );
}
