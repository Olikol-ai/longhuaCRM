import {
  CheckCircle2,
  Loader2,
  Video,
  Wifi,
  Mic,
  Camera,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEVICE_ROWS = [
  {
    key: 'microphone',
    label: 'Микрофон',
    icon: Mic,
    okText: 'Работает',
    failText: 'Не найден',
  },
  {
    key: 'camera',
    label: 'Камера',
    icon: Camera,
    okText: 'Работает',
    failText: 'Не найдена',
  },
  {
    key: 'network',
    label: 'Соединение',
    icon: Wifi,
    okText: 'Хорошее',
    failText: 'Проблемы',
  },
];

function resolveCheckPhase({ checking, checks }) {
  if (checking) return 'checking';
  if (!checks) return 'idle';
  const rows = [checks.camera, checks.microphone, checks.network];
  if (rows.some((row) => row && row.ok === false)) return 'error';
  if (rows.every((row) => row && row.ok === true)) return 'ok';
  return 'idle';
}

function PhaseBadge({ phase }) {
  if (phase === 'checking') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-500/30"
        data-testid="lesson-video-check-phase"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Проверка…
      </span>
    );
  }
  if (phase === 'ok') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-500/30"
        data-testid="lesson-video-check-phase"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Проверено
      </span>
    );
  }
  if (phase === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/25 dark:text-rose-300 dark:ring-rose-500/30"
        data-testid="lesson-video-check-phase"
      >
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Ошибка
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border"
      data-testid="lesson-video-check-phase"
    >
      Ожидание
    </span>
  );
}

function DeviceStatusRow({ def, check, checking }) {
  const Icon = def.icon;
  const ok = Boolean(check?.ok);
  const statusText = checking
    ? 'Проверка…'
    : check
      ? ok
        ? def.okText
        : def.failText
      : '—';

  return (
    <li
      className="flex min-h-12 items-center gap-3 rounded-xl bg-background/80 px-3 py-2.5 ring-1 ring-border/60 sm:min-h-[3.25rem]"
      data-testid={`lesson-video-device-${def.key}`}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          checking
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
            : ok
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : check
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{def.label}</p>
        <p
          className={cn(
            'text-xs font-medium',
            checking
              ? 'text-amber-800 dark:text-amber-200/90'
              : ok
                ? 'text-emerald-700 dark:text-emerald-300'
                : check
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-muted-foreground',
          )}
        >
          {statusText}
        </p>
      </div>
      {!checking && check ? (
        ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Ок" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Ошибка" />
        )
      ) : null}
    </li>
  );
}

/**
 * Pre-join screen — CRM design tokens only (inherits ThemeContext via html.dark).
 */
export default function VideoPrejoin({
  isHost,
  checking,
  checks,
  canJoin,
  tooEarly,
  minutesUntilStart,
  hostRequiresAccount,
  onCheck,
  onJoin,
  onForceJoin,
  joinLabel,
}) {
  const phase = resolveCheckPhase({ checking, checks });

  return (
    <div
      className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:space-y-6 sm:p-6 lg:p-7"
      data-testid="lesson-video-prejoin"
    >
      <div className="space-y-2 text-center sm:text-left">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand sm:mx-0">
          <Video className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">
          {isHost ? 'Вы проводите урок' : 'Ваш урок начинается'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Проверьте оборудование, затем войдите в видеоурок
        </p>
      </div>

      <section
        className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3 sm:p-4"
        aria-labelledby="lesson-video-equipment-title"
        data-testid="lesson-video-equipment-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="lesson-video-equipment-title" className="text-sm font-semibold text-foreground sm:text-base">
            Проверка оборудования
          </h3>
          <PhaseBadge phase={phase} />
        </div>

        <ul className="grid gap-2">
          {DEVICE_ROWS.map((def) => (
            <DeviceStatusRow
              key={def.key}
              def={def}
              check={checks?.[def.key]}
              checking={checking}
            />
          ))}
        </ul>

        <Button
          type="button"
          onClick={onCheck}
          disabled={checking}
          data-testid="lesson-video-recheck"
          className="h-11 min-h-11 w-full bg-foreground text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 active:scale-[0.99] disabled:opacity-60 sm:h-12 sm:min-h-12"
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Проверка…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Проверить снова
            </>
          )}
        </Button>
      </section>

      {tooEarly ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-900 dark:text-amber-200">
          Урок ещё не начался
          {typeof minutesUntilStart === 'number'
            ? ` · осталось около ${Math.max(0, minutesUntilStart)} мин`
            : ''}
          . Войти можно за 10 минут до старта.
        </p>
      ) : null}

      {hostRequiresAccount ? (
        <p className="text-center text-xs text-muted-foreground">
          Для начала урока нужен аккаунт преподавателя на видеосервере.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="h-11 min-h-11 w-full text-sm font-semibold sm:h-12 sm:min-h-12"
          onClick={onJoin}
          disabled={!canJoin || checking}
          data-testid="lesson-video-join"
        >
          {joinLabel}
        </Button>

        {isHost && !canJoin ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 w-full"
            onClick={onForceJoin}
          >
            Начать раньше (преподаватель)
          </Button>
        ) : null}
      </div>
    </div>
  );
}
