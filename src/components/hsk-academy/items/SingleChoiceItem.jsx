import { cn } from '@/lib/utils';
import MediaStem from './MediaStem';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function SingleChoiceItem({
  question,
  selectedIds = [],
  onSelect,
  prefetchUrls = [],
  hideAudioKey = null,
  hideAllAudio = false,
}) {
  const options = question?.answers || [];
  const attachments = question?.attachments || [];
  const passage = question?.passageText || question?.passage_text;

  return (
    <div className="learner-content space-y-3.5 sm:space-y-5 min-w-0">
      {passage ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-3 sm:px-4 sm:py-3.5 max-h-[32vh] overflow-y-auto">
          <div className="learner-passage text-foreground">{passage}</div>
        </div>
      ) : null}

      <MediaStem
        attachments={attachments}
        prefetchUrls={prefetchUrls}
        hideAudioKey={hideAudioKey}
        hideAllAudio={hideAllAudio}
      />

      <div className="learner-stem text-foreground">{question?.stem}</div>

      <div className="learner-options" role="listbox" aria-label="Варианты ответа">
        {options.map((opt, idx) => {
          const id = opt.snapshotId || opt.snapshot_id || opt.id;
          const selected = selectedIds.includes(id);
          const letter = LETTERS[idx] || String(idx + 1);
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(
                'learner-option-row w-full text-left rounded-lg border transition-colors',
                'flex items-start gap-3',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-brand bg-brand/10 text-foreground'
                  : 'border-border bg-card hover:bg-muted/50 active:bg-muted text-foreground',
              )}
              onClick={() => onSelect(id)}
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                  selected
                    ? 'bg-brand text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {letter}
              </span>
              <span className="learner-option min-w-0 flex-1">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
