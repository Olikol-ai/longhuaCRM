import { useEffect, useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userFacingError } from '@/lib/userFacingError';

export default function ExamContentMedia() {
  const [items, setItems] = useState([]);
  const [kind, setKind] = useState('');
  const [form, setForm] = useState({
    kind: 'audio',
    storage_key: '',
    title: '',
    mime: '',
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const reload = async () => {
    const rows = await api.examContent.media.list(kind || undefined);
    setItems(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    reload().catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const register = async () => {
    setError('');
    setOk('');
    try {
      await api.examContent.media.register(form);
      setForm({ kind: 'audio', storage_key: '', title: '', mime: '' });
      setOk('Media зарегистрирован в библиотеке');
      await reload();
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <ExamContentShell active="media">
      <p className="text-sm text-muted-foreground">
        Сначала загрузите файл через SecureFiles, затем зарегистрируйте storage_key здесь.
        Один asset можно привязать к нескольким заданиям и группам.
      </p>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">Зарегистрировать asset</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Тип</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="audio">audio</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="pdf">pdf</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Название</span>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-muted-foreground">storage_key (SecureFiles)</span>
            <Input
              value={form.storage_key}
              onChange={(e) => setForm({ ...form, storage_key: e.target.value })}
              placeholder="files/…"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">MIME</span>
            <Input value={form.mime} onChange={(e) => setForm({ ...form, mime: e.target.value })} />
          </label>
        </div>
        <Button type="button" disabled={!form.storage_key.trim()} onClick={register}>
          Добавить в библиотеку
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="text-sm text-muted-foreground">{ok}</p> : null}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <h2 className="font-medium">Библиотека ({items.length})</h2>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Все типы</option>
            <option value="audio">audio</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="pdf">pdf</option>
          </select>
        </div>
        <ul className="divide-y divide-border">
          {items.map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap gap-2 justify-between items-center">
              <div>
                <div className="font-medium">{m.title || m.storageKey || m.storage_key}</div>
                <div className="text-xs text-muted-foreground">
                  {m.kind} · {m.mime || '—'} · {m.storageKey || m.storage_key}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm('Архивировать asset (если нет ссылок)?')) return;
                  api.examContent.media
                    .archive(m.id)
                    .then(reload)
                    .catch((e) => setError(userFacingError(e)));
                }}
              >
                Архив
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </ExamContentShell>
  );
}
