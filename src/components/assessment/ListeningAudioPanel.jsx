import { Headphones } from 'lucide-react';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import { resolveAttachmentMediaUrl } from '@/lib/auth-media-url';
import { assessment } from '@/api/assessment.api';

/**
 * Shared listening stem: one CRM audio player + optional instructions.
 * Always uses the system-wide AuthenticatedAudio (no alternate players).
 */
export default function ListeningAudioPanel({
  attachment,
  title = 'Аудиозапись',
  instructions = null,
  src: srcProp = null,
}) {
  const fromAttachment = resolveAttachmentMediaUrl(attachment, (id) =>
    assessment.downloadAttachmentUrl(id, 'inline'),
  );
  const src = srcProp || attachment?.url || fromAttachment;

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5 space-y-3"
      data-testid="listening-audio-panel"
    >
      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand-soft/40">
          <Headphones className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="learner-label font-medium">{title}</p>
          <p className="learner-meta text-slate-500 dark:text-slate-400">
            Можно слушать, ставить на паузу и перематывать
          </p>
        </div>
      </div>

      <AuthenticatedAudio src={src} />

      {instructions ? (
        <div className="rounded-xl border border-sky-200/80 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-3.5 sm:p-4">
          <p className="learner-label text-sky-800 dark:text-sky-200 mb-1">
            Инструкция к заданию
          </p>
          <div className="learner-body text-foreground whitespace-pre-wrap">{instructions}</div>
        </div>
      ) : null}
    </div>
  );
}
