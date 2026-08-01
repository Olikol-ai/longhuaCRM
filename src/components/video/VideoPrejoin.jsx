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
import { useTheme } from '@/lib/ThemeContext';
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

function PhaseBadge({ phase, isDark }) {
  if (phase === 'checking') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          isDark
            ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
            : 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25',
        )}
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
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          isDark
            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
            : 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25',
        )}
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
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          isDark
            ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
            : 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25',
        )}
        data-testid="lesson-video-check-phase"
      >
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Ошибка
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isDark
          ? 'bg-white/5 text-slate-400 ring-1 ring-white/10'
          : 'bg-muted text-muted-foreground ring-1 ring-border',
      )}
      data-testid="lesson-video-check-phase"
    >
      Ожидание
    </span>
  );
}

function DeviceStatusRow({ def, check, checking, isDark }) {
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
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 sm:min-h-[3.25rem]',
        isDark ? 'bg-neutral-950/60' : 'bg-background/80',
      )}
      data-testid={`lesson-video-device-${def.key}`}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          checking
            ? isDark
              ? 'bg-amber-500/15 text-amber-200'
              : 'bg-amber-500/10 text-amber-700'
            : ok
              ? isDark
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-emerald-500/10 text-emerald-700'
              : check
                ? isDark
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-rose-500/10 text-rose-700'
                : isDark
                  ? 'bg-white/5 text-slate-400'
                  : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {checking ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', isDark ? 'text-slate-100' : 'text-foreground')}>
          {def.label}
        </p>
        <p
          className={cn(
            'text-xs font-medium',
            checking
              ? isDark
                ? 'text-amber-200/90'
                : 'text-amber-800'
              : ok
                ? isDark
                  ? 'text-emerald-300'
                  : 'text-emerald-700'
                : check
                  ? isDark
                    ? 'text-rose-300'
                    : 'text-rose-700'
                  : isDark
                    ? 'text-slate-500'
                    : 'text-muted-foreground',
          )}
        >
          {statusText}
        </p>
      </div>
      {!checking && check ? (
        ok ? (
          <CheckCircle2
            className={cn('h-5 w-5 shrink-0', isDark ? 'text-emerald-400' : 'text-emerald-600')}
            aria-label="Ок"
          />
        ) : (
          <AlertCircle
            className={cn('h-5 w-5 shrink-0', isDark ? 'text-rose-400' : 'text-rose-600')}
            aria-label="Ошибка"
          />
        )
      ) : null}
    </li>
  );
}

/**
 * Pre-join screen: equipment check card + primary CTA (user gesture for Jitsi).
 * Device probing logic stays in the parent via onCheck / checks props.
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const phase = resolveCheckPhase({ checking, checks });

  return (
    <div
      className={cn(
        'w-full max-w-lg space-y-5 rounded-2xl border p-4 shadow-sm sm:space-y-6 sm:p-6 lg:p-7',
        isDark
          ? 'border-white/10 bg-neutral-900 text-slate-100'
          : 'border-border bg-card text-foreground',
      )}
      data-testid="lesson-video-prejoin"
    >
      <div className="space-y-2 text-center sm:text-left">
        <div
          className={cn(
            'mx-auto flex h-12 w-12 items-center justify-center rounded-2xl sm:mx-0',
            isDark ? 'bg-brand/15 text-brand' : 'bg-brand/10 text-brand',
          )}
        >
          <Video className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold sm:text-xl">
          {isHost ? 'Вы проводите урок' : 'Ваш урок начинается'}
        </h2>
        <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-muted-foreground')}>
          Проверьте оборудование, затем войдите в видеоурок
        </p>
      </div>

      <section
        className={cn(
          'space-y-3 rounded-2xl border p-3 sm:p-4',
          isDark
            ? 'border-white/10 bg-neutral-950/50'
            : 'border-border bg-muted/40',
        )}
        aria-labelledby="lesson-video-equipment-title"
        data-testid="lesson-video-equipment-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="lesson-video-equipment-title"
            className="text-sm font-semibold sm:text-base"
          >
            Проверка оборудования
          </h3>
          <PhaseBadge phase={phase} isDark={isDark} />
        </div>

        <ul className="grid gap-2 sm:grid-cols-1 lg:grid-cols-1">
          {DEVICE_ROWS.map((def) => (
            <DeviceStatusRow
              key={def.key}
              def={def}
              check={checks?.[def.key]}
              checking={checking}
              isDark={isDark}
            />
          ))}
        </ul>

        <Button
          type="button"
          onClick={onCheck}
          disabled={checking}
          data-testid="lesson-video-recheck"
          className={cn(
            'h-11 min-h-11 w-full text-sm font-semibold shadow-sm transition active:scale-[0.99] sm:h-12 sm:min-h-12',
            isDark
              ? 'bg-white text-neutral-950 hover:bg-slate-100 disabled:bg-white/40'
              : 'bg-foreground text-background hover:bg-foreground/90',
          )}
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
        <p
          className={cn(
            'rounded-xl px-3 py-2.5 text-center text-sm',
            isDark
              ? 'bg-amber-500/10 text-amber-200'
              : 'bg-amber-500/10 text-amber-900',
          )}
        >
          Урок ещё не начался
          {typeof minutesUntilStart === 'number'
            ? ` · осталось около ${Math.max(0, minutesUntilStart)} мин`
            : ''}
          . Войти можно за 10 минут до старта.
        </p>
      ) : null}

      {hostRequiresAccount ? (
        <p
          className={cn(
            'text-center text-xs',
            isDark ? 'text-slate-500' : 'text-muted-foreground',
          )}
        >
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
            className={cn(
              'h-11 min-h-11 w-full',
              isDark ? 'border-white/15 bg-transparent hover:bg-white/5' : '',
            )}
            onClick={onForceJoin}
          >
            Начать раньше (преподаватель)
          </Button>
        ) : null}
      </div>
    </div>
  );
}
