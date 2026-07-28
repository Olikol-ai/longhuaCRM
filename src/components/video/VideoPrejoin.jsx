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
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6"
      data-testid="lesson-video-prejoin"
    >
      <div className="text-center space-y-2">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center">
          <Video className="h-6 w-6" />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
          {isHost ? 'Вы проводите урок' : 'Ваш урок начинается'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Проверьте оборудование, затем войдите в видеоурок
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
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
                className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {item.label}
                </span>
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : item.ok ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Готово
                  </span>
                ) : (
                  <span className="text-xs text-amber-600">Нужно разрешение</span>
                )}
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={onCheck}
          disabled={checking}
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Проверяем…
            </>
          ) : (
            'Проверить снова'
          )}
        </Button>
      </div>

      {tooEarly && (
        <p className="text-sm text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2">
          Войти можно за 10 минут до начала
          {typeof minutesUntilStart === 'number'
            ? ` (через ${Math.max(0, minutesUntilStart)} мин)`
            : ''}
          .
        </p>
      )}

      {hostRequiresAccount && (
        <p className="text-xs text-center text-red-600 dark:text-red-400 leading-relaxed bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
          Этот видеосервер требует личный аккаунт и не подходит для уроков.
          Администратору нужно настроить Jitsi с гостевым доступом (JITSI_BASE_URL).
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full h-12 text-base"
          onClick={onJoin}
          disabled={tooEarly && !isHost}
          data-testid="lesson-video-join"
        >
          <Video className="h-5 w-5 mr-2" />
          {joinLabel}
        </Button>
        {tooEarly && isHost && (
          <Button type="button" variant="outline" className="w-full" onClick={onForceJoin}>
            Начать урок досрочно
          </Button>
        )}
        {!canJoin && !tooEarly && (
          <p className="text-xs text-center text-slate-400">
            Окно входа в урок сейчас закрыто
          </p>
        )}
      </div>
    </div>
  );
}
