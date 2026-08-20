import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/design-system';

export const FOLDER_NAME_MAX_LENGTH = 255;

/**
 * Rename material folder — Design System dialog (no window.prompt).
 * Enter saves, Escape closes via Dialog onOpenChange.
 */
export default function RenameFolderDialog({
  open,
  folderName = '',
  busy = false,
  onOpenChange,
  onSave,
}) {
  const [value, setValue] = useState(folderName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue(folderName || '');
      setError('');
    }
  }, [open, folderName]);

  const submit = () => {
    if (busy) return;
    const next = value.trim();
    if (!next) {
      setError('Введите название папки');
      return;
    }
    if (next.length > FOLDER_NAME_MAX_LENGTH) {
      setError(`Не длиннее ${FOLDER_NAME_MAX_LENGTH} символов`);
      return;
    }
    if (next === (folderName || '').trim()) {
      onOpenChange?.(false);
      return;
    }
    onSave?.(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="rename-folder-dialog">
        <DialogHeader>
          <DialogTitle>Переименовать папку</DialogTitle>
          <DialogDescription>
            Изменится только название. Материалы и доступы останутся без изменений.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label htmlFor="folder-rename-name" className="text-sm font-medium text-foreground">
            Название папки
          </label>
          <Input
            id="folder-rename-name"
            value={value}
            maxLength={FOLDER_NAME_MAX_LENGTH}
            disabled={busy}
            autoFocus
            data-testid="rename-folder-input"
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          {error ? (
            <p className="text-xs text-destructive" role="alert" data-testid="rename-folder-error">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            intent="secondary"
            disabled={busy}
            onClick={() => onOpenChange?.(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            intent="primary"
            loading={busy}
            data-testid="rename-folder-save"
            onClick={submit}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
