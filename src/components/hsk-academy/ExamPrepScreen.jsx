import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Prep step before starting a session — compact CRM Card + primary CTA.
 */
export default function ExamPrepScreen({
  title,
  lead,
  metaRows = [],
  tips = [],
  busy = false,
  error = '',
  onBack,
  onStart,
  startLabel = 'Начать экзамен',
}) {
  return (
    <Card className="border-border bg-card p-4 sm:p-5 space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">{title}</h2>
        {lead ? <p className="text-sm text-muted-foreground mt-1">{lead}</p> : null}
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
        {metaRows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 sm:block border-b border-border/60 pb-2 sm:border-0 sm:pb-0">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium text-foreground text-right sm:text-left sm:mt-0.5">
              {row.value || '—'}
            </dd>
          </div>
        ))}
      </dl>

      {tips.length ? (
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {tips.join(' · ')}
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={onBack}
          disabled={busy}
        >
          Назад
        </Button>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto sm:min-w-[10rem]"
          onClick={onStart}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Подготовка…
            </>
          ) : (
            startLabel
          )}
        </Button>
      </div>
    </Card>
  );
}
