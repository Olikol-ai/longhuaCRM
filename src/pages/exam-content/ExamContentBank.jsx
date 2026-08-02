import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import QuestionPreviewDialog from '@/components/assessment/QuestionPreviewDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  changeActionLabel,
  contentStatusLabel,
  formatChangeSummary,
  formatItemStatsMessage,
  itemTypeLabel,
} from '@/lib/examContentLabels';
import { userFacingError } from '@/lib/userFacingError';

const emptyForm = () => ({
  stem: '',
  explanation: '',
  topic: '',
  section_key: 'reading',
  difficulty: 1,
  options: [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
  vocabulary: [{ word: '', pinyin: '', translation: '' }],
});

export default function ExamContentBank() {
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [sectionKey, setSectionKey] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVocab, setHasVocab] = useState(false);
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [audioAssets, setAudioAssets] = useState([]);
  const [groupAudioPick, setGroupAudioPick] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  useEffect(() => {
    api.examContent.taxonomy
      .versions('hsk')
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(userFacingError(err)));
  }, []);

  useEffect(() => {
    if (!versionCode) return;
    api.examContent.taxonomy
      .levels(versionCode)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setLevels(list);
        setLevelId((prev) => prev || list[0]?.id || '');
      })
      .catch((err) => setError(userFacingError(err)));
  }, [versionCode]);

  const reload = async () => {
    const [rows, groupRows, mediaRows] = await Promise.all([
      api.examContent.items.list({
        versionId: versionId || undefined,
        levelId: levelId || undefined,
        sectionKey: sectionKey || undefined,
        status: status || undefined,
        search: search || undefined,
        hasAudio: hasAudio || undefined,
        difficultyMin: difficulty === 'easy' ? 1 : difficulty === 'mid' ? 3 : difficulty === 'hard' ? 5 : undefined,
        difficultyMax: difficulty === 'easy' ? 2 : difficulty === 'mid' ? 4 : difficulty === 'hard' ? 5 : undefined,
        vocabularyWord: hasVocab ? search || undefined : undefined,
      }),
      api.examContent.groups.list({
        versionId: versionId || undefined,
        levelId: levelId || undefined,
      }),
      api.examContent.media.list('audio'),
    ]);
    setItems(Array.isArray(rows) ? rows : []);
    setGroups(Array.isArray(groupRows) ? groupRows : []);
    setAudioAssets(Array.isArray(mediaRows) ? mediaRows : []);
  };

  useEffect(() => {
    if (!versionId) return;
    reload().catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, levelId, sectionKey, status, hasAudio, difficulty, hasVocab]);

  const linkAudioToGroup = async (groupId) => {
    const assetId = groupAudioPick[groupId];
    if (!assetId) {
      setError('Выберите аудиофайл для группы');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.examContent.media.linkGroup(assetId, {
        group_id: groupId,
        role: 'stimulus',
        cascade_items: true,
      });
      setOk('Аудио прикреплено к группе и её вопросам');
      setGroupAudioPick((prev) => ({ ...prev, [groupId]: '' }));
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const payload = {
        version_id: versionId,
        level_id: levelId,
        section_key: form.section_key,
        topic: form.topic || null,
        difficulty: Number(form.difficulty) || 1,
        stem: form.stem,
        explanation: form.explanation || null,
        options: form.options.filter((o) => o.text.trim()),
        vocabulary: form.vocabulary.filter((v) => v.word.trim()),
      };
      if (editingId) {
        await api.examContent.items.update(editingId, payload);
        setOk('Изменения сохранены');
      } else {
        const created = await api.examContent.items.create(payload);
        setOk('Черновик создан');
        setSelectedId(created?.item?.id || '');
      }
      setForm(emptyForm());
      setEditingId('');
      await reload();
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = async (id) => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const data = await api.examContent.items.get(id);
      const item = data?.item || data;
      const question = data?.question || {};
      const answers = question.answers || [];
      setEditingId(item.id);
      setSelectedId(item.id);
      setForm({
        stem: question.stem || item.stemSearch || item.stem_search || '',
        explanation: question.explanation || '',
        topic: item.topic || '',
        section_key: item.sectionKey || item.section_key || 'reading',
        difficulty: item.difficulty || 1,
        options: (answers.length
          ? answers
          : [
              { text: '', is_correct: true },
              { text: '', is_correct: false },
            ]
        ).map((a) => ({
          text: a.text || '',
          is_correct: Boolean(a.isCorrect ?? a.is_correct),
        })),
        vocabulary: (item.vocabulary || []).length
          ? item.vocabulary.map((v) => ({
              word: v.word || '',
              pinyin: v.pinyin || '',
              translation: v.translation || '',
            }))
          : [{ word: '', pinyin: '', translation: '' }],
      });
      setOk('Задание загружено для редактирования');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    setError('');
    try {
      const data = await api.examContent.items.preview({
        version_id: versionId,
        level_id: levelId,
        section_key: form.section_key,
        difficulty: Number(form.difficulty) || 1,
        stem: form.stem,
        explanation: form.explanation || null,
        options: form.options.filter((o) => o.text.trim()),
        vocabulary: form.vocabulary.filter((v) => v.word.trim()),
      });
      setPreview(data);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const previewIds = useMemo(() => items.map((item) => item.id), [items]);

  const loadHistory = async (id) => {
    setSelectedId(id);
    try {
      const rows = await api.examContent.items.history(id);
      setHistory(Array.isArray(rows) ? rows : []);
      const stats = await api.examContent.items.stats(id).catch(() => null);
      if (stats) {
        setOk(formatItemStatsMessage(stats));
      }
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const bulkPublish = async () => {
    if (!selectedIds.length) return;
    setBusy(true);
    try {
      await api.examContent.bulk({ action: 'publish', item_ids: selectedIds });
      setSelectedIds([]);
      await reload();
      setOk('Выбранные задания опубликованы');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ExamContentShell
      active="bank"
      title="Банк вопросов HSK"
      description="Только задания для подготовки к HSK. Они не появляются в «Мои вопросы» и не подставляются в домашние задания."
    >
      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">Поиск</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Версия</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.code}>{v.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Уровень</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Раздел</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={sectionKey}
              onChange={(e) => setSectionKey(e.target.value)}
            >
              <option value="">Все</option>
              <option value="listening">Аудирование</option>
              <option value="reading">Чтение</option>
              <option value="writing">Письмо</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Статус</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Все</option>
              <option value="draft">Черновик</option>
              <option value="published">Опубликовано</option>
              <option value="archived">Архив</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1 grow">
            <span className="text-muted-foreground">Текст / тема / слово</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') reload().catch((err) => setError(userFacingError(err)));
              }}
              placeholder="текст задания, тема или 汉字"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Сложность</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Все</option>
              <option value="easy">Лёгкие (1–2)</option>
              <option value="mid">Средние (3–4)</option>
              <option value="hard">Сложные (5)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={hasAudio} onChange={(e) => setHasAudio(e.target.checked)} />
            Есть аудио
          </label>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={hasVocab} onChange={(e) => setHasVocab(e.target.checked)} />
            Искать в новых словах
          </label>
          <Button type="button" variant="outline" onClick={() => reload().catch((e) => setError(userFacingError(e)))}>
            Найти
          </Button>
          <Button type="button" variant="secondary" disabled={!selectedIds.length || busy} onClick={bulkPublish}>
            Опубликовать выбранные
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">
          {editingId ? 'Редактирование задания' : 'Конструктор задания'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {editingId
            ? 'Изменения сохраняются сразу. Уже начатые учениками попытки не меняются.'
            : 'Заполните условие, варианты ответа и новые слова.'}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-muted-foreground">Условие</span>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.stem}
              onChange={(e) => setForm({ ...form, stem: e.target.value })}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Раздел</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2"
              value={form.section_key}
              onChange={(e) => setForm({ ...form, section_key: e.target.value })}
            >
              <option value="reading">Чтение</option>
              <option value="listening">Аудирование</option>
              <option value="writing">Письмо</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Тема</span>
            <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Сложность</span>
            <Input
              type="number"
              min={1}
              max={5}
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-muted-foreground">Объяснение</span>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            />
          </label>
        </div>
        <h3 className="text-sm font-medium">Варианты ответа</h3>
        {form.options.map((opt, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 items-center">
            <Input
              className="grow"
              value={opt.text}
              placeholder={`Вариант ${idx + 1}`}
              onChange={(e) => {
                const options = [...form.options];
                options[idx] = { ...options[idx], text: e.target.value };
                setForm({ ...form, options });
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="radio"
                name="correct"
                checked={opt.is_correct}
                onChange={() => {
                  const options = form.options.map((o, i) => ({ ...o, is_correct: i === idx }));
                  setForm({ ...form, options });
                }}
              />
              верный
            </label>
          </div>
        ))}
        <h3 className="text-sm font-medium">Новые слова</h3>
        {form.vocabulary.map((v, idx) => (
          <div key={idx} className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="汉字"
              value={v.word}
              onChange={(e) => {
                const vocabulary = [...form.vocabulary];
                vocabulary[idx] = { ...vocabulary[idx], word: e.target.value };
                setForm({ ...form, vocabulary });
              }}
            />
            <Input
              placeholder="пиньинь"
              value={v.pinyin}
              onChange={(e) => {
                const vocabulary = [...form.vocabulary];
                vocabulary[idx] = { ...vocabulary[idx], pinyin: e.target.value };
                setForm({ ...form, vocabulary });
              }}
            />
            <Input
              placeholder="перевод"
              value={v.translation}
              onChange={(e) => {
                const vocabulary = [...form.vocabulary];
                vocabulary[idx] = { ...vocabulary[idx], translation: e.target.value };
                setForm({ ...form, vocabulary });
              }}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setForm({
                ...form,
                vocabulary: [...form.vocabulary, { word: '', pinyin: '', translation: '' }],
              })
            }
          >
            + слово
          </Button>
          <Button type="button" variant="outline" onClick={runPreview} disabled={!form.stem.trim()}>
            Как увидит ученик
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId('');
                setForm(emptyForm());
                setOk('');
              }}
            >
              Отменить
            </Button>
          ) : null}
          <Button type="button" disabled={busy || !form.stem.trim()} onClick={create}>
            {busy ? 'Сохранение…' : editingId ? 'Сохранить' : 'Сохранить черновик'}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="text-sm text-muted-foreground">{ok}</p> : null}
      </div>

      {preview ? (
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/30">
          <h2 className="font-medium">Как увидит ученик (без публикации)</h2>
          <p className="text-base">{preview.stem}</p>
          <ul className="space-y-1">
            {(preview.options || []).map((o) => (
              <li key={o.id} className="text-sm rounded-md border border-border px-3 py-2 bg-background">
                {o.text}
              </li>
            ))}
          </ul>
          {(preview.vocabulary || []).length ? (
            <p className="text-sm text-muted-foreground">
              Слова: {(preview.vocabulary || []).map((v) => v.word).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">Группы вопросов ({groups.length})</h2>
        <p className="text-sm text-muted-foreground">
          Прикрепите одно аудио сразу ко всей группе — оно появится у всех вопросов группы на экзамене.
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет групп для этого уровня.</p>
        ) : (
          <ul className="divide-y divide-border">
            {groups.slice(0, 30).map((g) => (
              <li key={g.id} className="py-3 flex flex-wrap gap-3 items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.title || 'Группа без названия'}</div>
                  <div className="text-xs text-muted-foreground">
                    {STATUS_RU[g.status] || g.status}
                    {g.sectionKey || g.section_key
                      ? ` · ${g.sectionKey || g.section_key}`
                      : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm max-w-[14rem]"
                    value={groupAudioPick[g.id] || ''}
                    onChange={(e) =>
                      setGroupAudioPick((prev) => ({ ...prev, [g.id]: e.target.value }))
                    }
                  >
                    <option value="">Аудио…</option>
                    {audioAssets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title || m.storageKey || m.storage_key || m.id}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !groupAudioPick[g.id]}
                    onClick={() => linkAudioToGroup(g.id)}
                  >
                    Прикрепить аудио
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h2 className="font-medium">Банк ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет заданий по фильтру.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-3 flex flex-wrap gap-3 items-start justify-between">
                <div className="flex gap-2 items-start min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="text-left min-w-0 space-y-1 rounded-md hover:bg-muted/50 -m-1 p-1"
                    onClick={() => setPreviewId(item.id)}
                  >
                    <div className="font-medium">
                      {item.topic || item.sectionKey || item.section_key || 'Без темы'}
                    </div>
                    <div className="text-sm text-foreground/90 line-clamp-2 whitespace-pre-wrap">
                      {item.stemSearch || item.stem_search || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {contentStatusLabel(item.status)}
                      {' · '}версия {item.revision || 1}
                      {' · '}{itemTypeLabel(item.itemTypeCode || item.item_type_code)}
                      {(item.vocabulary || []).length
                        ? ` · ${(item.vocabulary || []).map((v) => v.word).filter(Boolean).join(', ')}`
                        : ''}
                    </div>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPreviewId(item.id)}>
                    Просмотр
                  </Button>
                  {item.status !== 'archived' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(item.id)}
                    >
                      Изменить
                    </Button>
                  ) : null}
                  {item.status === 'draft' || item.status === 'in_review' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        api.examContent.items
                          .publish(item.id)
                          .then(reload)
                          .catch((e) => setError(userFacingError(e)))
                      }
                    >
                      Опубликовать
                    </Button>
                  ) : null}
                  {item.status !== 'archived' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm('Снять с публикации и отправить в архив?')) return;
                        api.examContent.items
                          .archive(item.id)
                          .then(() => {
                            setPreviewId((prev) => (prev === item.id ? null : prev));
                            return reload();
                          })
                          .catch((e) => setError(userFacingError(e)));
                      }}
                    >
                      В архив
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Создать копию задания как новый черновик"
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Создать копию этого задания как новый черновик? Исходное задание не изменится.',
                        )
                      ) {
                        return;
                      }
                      api.examContent.items
                        .rollback(item.id)
                        .then(() => {
                          setOk('Создана копия задания (черновик)');
                          return reload();
                        })
                        .catch((e) => setError(userFacingError(e)));
                    }}
                  >
                    Создать копию
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => loadHistory(item.id)}>
                    История
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && history.length ? (
        <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
          <h2 className="font-medium">История изменений</h2>
          <ul className="text-sm space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-muted-foreground">
                {h.createdAt || h.created_at}: {changeActionLabel(h.action)} —{' '}
                {formatChangeSummary(h)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <QuestionPreviewDialog
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        bank="exam_content"
        questionIds={previewIds}
        initialId={previewId}
        canDelete
        onEdit={(id) => {
          setPreviewId(null);
          void startEdit(id);
        }}
        onRequestDelete={(_detail, id) => {
          setPreviewId(null);
          if (!window.confirm('Снять с публикации и отправить в архив?')) return;
          api.examContent.items
            .archive(id)
            .then(reload)
            .catch((e) => setError(userFacingError(e)));
        }}
        onCopied={() => {
          void reload();
        }}
      />
    </ExamContentShell>
  );
}
