import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Prep step before starting a session (CRM Card + primary CTA).
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
    <Card className="p-5 sm:p-6 space-y-5 border-border bg-card">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {lead ? <p className="text-sm text-muted-foreground mt-1">{lead}</p> : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {metaRows.map((row) => (
          <div key={row.label} className="rounded-md border border-border px-3 py-2 bg-background">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">{row.value || '—'}</dd>
          </div>
        ))}
      </dl>

      {tips.length ? (
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onBack} disabled={busy}>
          Назад
        </Button>
        <Button type="button" className="min-h-11" onClick={onStart} disabled={busy}>
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
