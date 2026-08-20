import { useCallback, useEffect, useMemo, useState } from 'react';
import { Hand, Loader2, Pin } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import { formatJoinedAt, mergeRosterWithPresence } from '@/lib/lesson-video';
import LessonVideoParticipantDevices from '@/components/video/LessonVideoParticipantDevices';

function roleLabel(role) {
  if (role === 'teacher') return 'преподаватель';
  if (role === 'tutor') return 'репетитор';
  if (role === 'student') return 'ученик';
  if (role === 'guest') return 'гость';
  return role || 'участник';
}

/**
 * Compact Zoom-style participants list (popover / sheet body).
 */
export default function LessonVideoParticipantsPanel({
  lessonId,
  livePresence = [],
  jitsiParticipantCount = null,
  onPinParticipant,
  className,
}) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const res = await api.video.getParticipants(lessonId);
      setParticipants(res.participants || res.Participants || []);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить участников',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const roster = useMemo(
    () => mergeRosterWithPresence(participants, livePresence),
    [participants, livePresence],
  );

  return (
    <div
      className={cn('flex max-h-[min(60vh,24rem)] flex-col gap-2', className)}
      data-testid="lesson-video-participants"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Участники</span>
        <span>
          {roster.length}
          {typeof jitsiParticipantCount === 'number'
            ? ` · в видео ${jitsiParticipantCount}`
            : ''}
        </span>
      </div>

      {loading && !roster.length ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" />
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {roster.map((p, idx) => (
            <li
              key={`${p.role}-${p.student_id || p.presence?.id || p.name}-${idx}`}
              className={cn(
                'rounded-xl border border-border bg-muted/40 p-2.5',
                p.online && 'border-emerald-500/25',
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    p.online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs font-medium text-foreground">
                      {p.name}
                    </p>
                    {p.handRaised ? (
                      <Hand
                        className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300"
                        aria-label="Рука поднята"
                      />
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {roleLabel(p.role)}
                    {' · '}
                    {p.online ? 'онлайн' : 'офлайн'}
                    {p.joinedAt ? ` · ${formatJoinedAt(p.joinedAt)}` : ''}
                  </p>
                  <LessonVideoParticipantDevices
                    online={Boolean(p.online)}
                    audioMuted={p.audioMuted}
                    videoMuted={p.videoMuted}
                    screenSharing={Boolean(p.screenSharing)}
                    linkQuality={p.linkQuality}
                  />
                </div>
                {p.online && p.presence?.id && onPinParticipant ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    title="Закрепить"
                    aria-label={`Закрепить ${p.name}`}
                    onClick={() =>
                      onPinParticipant(p.presence.id, p.name || 'участника')
                    }
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
