import { cn } from '@/lib/utils';
import MediaStem from './MediaStem';

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
    <div className="space-y-4">
      {passage ? (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap">
          {passage}
        </div>
      ) : null}
      <MediaStem attachments={attachments} prefetchUrls={prefetchUrls} />
      <div className="text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap">
        {question?.stem}
      </div>
      <div className="grid gap-2" role="listbox" aria-label="Варианты ответа">
        {options.map((opt) => {
          const id = opt.snapshotId || opt.snapshot_id || opt.id;
          const selected = selectedIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(
                'min-h-11 w-full text-left rounded-md border px-4 py-3 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-brand bg-brand/10 text-foreground'
                  : 'border-border bg-card hover:bg-muted/60 text-foreground',
              )}
              onClick={() => onSelect(id)}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
