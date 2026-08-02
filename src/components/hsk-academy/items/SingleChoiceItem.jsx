import { cn } from '@/lib/utils';
import MediaStem from './MediaStem';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function SingleChoiceItem({
  question,
  selectedIds = [],
  onSelect,
  prefetchUrls = [],
}) {
  const options = question?.answers || [];
  const attachments = question?.attachments || [];
  const passage = question?.passageText || question?.passage_text;

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {passage ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed whitespace-pre-wrap max-h-[28vh] overflow-y-auto">
          {passage}
        </div>
      ) : null}

      <MediaStem attachments={attachments} prefetchUrls={prefetchUrls} />

      <div className="text-[15px] sm:text-base md:text-lg font-medium leading-snug sm:leading-relaxed whitespace-pre-wrap text-foreground">
        {question?.stem}
      </div>

      <div className="grid gap-2" role="listbox" aria-label="Варианты ответа">
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
                'min-h-12 sm:min-h-11 w-full text-left rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 text-sm transition-colors',
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
                  'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                  selected
                    ? 'bg-brand text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {letter}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
