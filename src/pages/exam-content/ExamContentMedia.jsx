import { useEffect, useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { userFacingError } from '@/lib/userFacingError';
import { MEDIA_KIND_LABEL } from '@/lib/examContentLabels';

const fieldCls =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm';

export default function ExamContentMedia() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [kind, setKind] = useState('');
  const [form, setForm] = useState({
    kind: 'audio',
    storage_key: '',
    title: '',
    mime: '',
  });
  const [linkAssetId, setLinkAssetId] = useState('');
  const [linkGroupId, setLinkGroupId] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const reload = async () => {
    const [mediaRows, groupRows] = await Promise.all([
      api.examContent.media.list(kind || undefined),
      api.examContent.groups.list({}),
    ]);
    setItems(Array.isArray(mediaRows) ? mediaRows : []);
    setGroups(Array.isArray(groupRows) ? groupRows : []);
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
      setOk('Файл добавлен в медиатеку');
      await reload();
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const linkAudioToGroup = async () => {
    setError('');
    setOk('');
    if (!linkAssetId || !linkGroupId) {
      setError('Выберите аудиофайл и группу вопросов');
      return;
    }
    try {
      await api.examContent.media.linkGroup(linkAssetId, {
        group_id: linkGroupId,
        role: 'stimulus',
        cascade_items: true,
      });
      setOk('Аудио прикреплено к группе (и ко всем вопросам в ней)');
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const audioItems = items.filter((m) => m.kind === 'audio');

  return (
    <ExamContentShell
      active="media"
      title="Медиатека"
      description="Аудио и изображения для заданий. Один файл можно использовать в нескольких вопросах и группах."
    >
      <Card className="p-4 space-y-3 border-border">
        <h2 className="font-medium">Добавить файл</h2>
        <p className="text-sm text-muted-foreground">
          Сначала загрузите файл через безопасное хранилище, затем укажите его ключ здесь.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Тип</span>
            <select
              className={fieldCls}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {Object.entries(MEDIA_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Название</span>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-muted-foreground">Ключ файла</span>
            <Input
              value={form.storage_key}
              onChange={(e) => setForm({ ...form, storage_key: e.target.value })}
              placeholder="files/…"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Формат файла (необязательно)</span>
            <Input value={form.mime} onChange={(e) => setForm({ ...form, mime: e.target.value })} />
          </label>
        </div>
        <Button type="button" className="min-h-11" disabled={!form.storage_key.trim()} onClick={register}>
          Добавить в библиотеку
        </Button>
      </Card>

      <Card className="p-4 space-y-3 border-border">
        <h2 className="font-medium">Прикрепить аудио к группе вопросов</h2>
        <p className="text-sm text-muted-foreground">
          Один аудиофайл может звучать для нескольких вопросов одной группы.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Аудио</span>
            <select
              className={fieldCls}
              value={linkAssetId}
              onChange={(e) => setLinkAssetId(e.target.value)}
            >
              <option value="">Выберите…</option>
              {audioItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title || m.storageKey || m.storage_key || m.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Группа вопросов</span>
            <select
              className={fieldCls}
              value={linkGroupId}
              onChange={(e) => setLinkGroupId(e.target.value)}
            >
              <option value="">Выберите…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title || g.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="button" className="min-h-11" onClick={linkAudioToGroup}>
          Прикрепить аудио
        </Button>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-muted-foreground">{ok}</p> : null}

      <Card className="p-4 space-y-3 border-border">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <h2 className="font-medium">Библиотека ({items.length})</h2>
          <select
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Все типы</option>
            {Object.entries(MEDIA_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <ul className="divide-y divide-border">
          {items.map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap gap-2 justify-between items-center">
              <div className="min-w-0">
                <div className="font-medium truncate">{m.title || m.storageKey || m.storage_key}</div>
                <div className="text-xs text-muted-foreground">
                  {MEDIA_KIND_LABEL[m.kind] || m.kind}
                  {m.mime ? ` · ${m.mime}` : ''}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-10"
                onClick={() => {
                  if (!window.confirm('Убрать файл из библиотеки?')) return;
                  api.examContent.media
                    .archive(m.id)
                    .then(reload)
                    .catch((e) => setError(userFacingError(e)));
                }}
              >
                Убрать
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </ExamContentShell>
  );
}
