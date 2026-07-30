import { CheckCircle2, Circle, Loader2, Video, Wifi, Mic, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ICONS = {
  camera: Camera,
  microphone: Mic,
  network: Wifi,
};

/**
 * Pre-join screen: equipment check + primary CTA (user gesture for Jitsi).
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
  const items = [
    checks?.camera,
    checks?.microphone,
    checks?.network,
  ].filter(Boolean);

  return (
    <div
      className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 sm:p-8"
      data-testid="lesson-video-prejoin"
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Video className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold sm:text-xl">
          {isHost ? 'Вы проводите урок' : 'Ваш урок начинается'}
        </h2>
        <p className="text-sm text-slate-400">
          Проверьте оборудование, затем войдите в видеоурок
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Проверка оборудования
        </p>
        <ul className="space-y-2">
          {(items.length
            ? items
            : [
                { ok: false, label: 'Камера', key: 'camera' },
                { ok: false, label: 'Микрофон', key: 'microphone' },
                { ok: false, label: 'Интернет', key: 'network' },
              ]
          ).map((item) => {
            const key =
              item.label === 'Камера'
                ? 'camera'
                : item.label === 'Микрофон'
                  ? 'microphone'
                  : 'network';
            const Icon = ICONS[key] || Circle;
            return (
              <li
                key={item.label}
                className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-800/70 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 text-sm text-slate-200">{item.label}</span>
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-600" />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {tooEarly ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-200">
          Урок ещё не начался
          {typeof minutesUntilStart === 'number'
            ? ` · осталось около ${Math.max(0, minutesUntilStart)} мин`
            : ''}
          . Войти можно за 10 минут до старта.
        </p>
      ) : null}

      {hostRequiresAccount ? (
        <p className="text-center text-xs text-slate-500">
          Для начала урока нужен аккаунт преподавателя на видеосервере.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-slate-700"
          onClick={onCheck}
          disabled={checking}
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Проверка…
            </>
          ) : (
            'Проверить снова'
          )}
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={onJoin}
          disabled={!canJoin || checking}
          data-testid="lesson-video-join"
        >
          {joinLabel}
        </Button>
      </div>

      {isHost && !canJoin ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full min-h-11 text-slate-400"
          onClick={onForceJoin}
        >
          Начать раньше (преподаватель)
        </Button>
      ) : null}
    </div>
  );
}
