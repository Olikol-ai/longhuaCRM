import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Honest UX for Screen Capture API tab/system audio.
 * Browsers only share audio when the user picks a Chrome/Edge tab (or
 * supported OS options) and enables “Share audio” in the native picker.
 */
export default function VideoScreenShareAudioHint({
  open,
  onOpenChange,
  onContinue,
}) {
  const [wantAudio, setWantAudio] = useState(true);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setWantAudio(true);
        onOpenChange?.(next);
      }}
    >
      <AlertDialogContent
        className="max-w-[min(100vw-1.5rem,28rem)] overflow-x-hidden"
        data-testid="lesson-video-share-audio-hint"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Демонстрация экрана со звуком</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-left text-foreground',
                )}
                data-testid="lesson-video-share-audio-checkbox"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[hsl(var(--brand))]"
                  checked={wantAudio}
                  onChange={(e) => setWantAudio(e.target.checked)}
                />
                <span className="min-w-0 text-sm leading-snug">
                  <span className="font-medium">Передавать звук вкладки / компьютера</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Ученики услышат аудирование, музыку и видео с выбранной вкладки.
                  </span>
                </span>
              </label>

              {wantAudio ? (
                <div className="space-y-2">
                  <p>В следующем окне браузера:</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>
                      Выберите вкладку <strong>«Вкладка Chrome»</strong> (или Edge), а не
                      весь экран — так надёжнее передаётся звук.
                    </li>
                    <li>
                      Включите галочку <strong>«Поделиться звуком вкладки»</strong> / Share
                      tab audio.
                    </li>
                  </ol>
                  <p className="text-xs">
                    На macOS / iPhone системный звук всего экрана обычно недоступен. Если
                    галочки нет — используйте вкладку браузера со звуком или отправьте mp3
                    в чат урока.
                  </p>
                </div>
              ) : (
                <p>
                  Демонстрация пойдёт без системного звука. Аудиофайлы можно отправить
                  ученикам в чат урока.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-2">
          <AlertDialogCancel type="button" className="min-h-11">
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className="min-h-11"
            data-testid="lesson-video-share-audio-continue"
            onClick={() => {
              onOpenChange?.(false);
              onContinue?.({ shareAudio: wantAudio });
            }}
          >
            {wantAudio ? 'Продолжить со звуком' : 'Демонстрация без звука'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
