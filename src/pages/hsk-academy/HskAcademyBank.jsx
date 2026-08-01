import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';

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
  publish: true,
});

const STATUS_RU = {
  draft: 'черновик',
  published: 'опубликовано',
  archived: 'архив',
};

export default function HskAcademyBank() {
  const { user } = useAuth();
  const role = user?.role;
  const canManage = ['admin', 'teacher', 'tutor'].includes(role);
  const [versions, setVersions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [versionCode, setVersionCode] = useState('hsk_2_0');
  const [levelId, setLevelId] = useState('');
  const [sectionKey, setSectionKey] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const versionId = useMemo(
    () => versions.find((v) => v.code === versionCode)?.id || '',
    [versions, versionCode],
  );

  useEffect(() => {
    if (!canManage) return;
    api.examAcademy.catalog
      .versions('hsk')
      .then((rows) => setVersions(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(userFacingError(err)));
  }, [canManage]);

  useEffect(() => {
    if (!versionCode || !canManage) return;
    api.examAcademy.catalog
      .levels(versionCode)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setLevels(list);
        setLevelId((prev) => prev || list[0]?.id || '');
      })
      .catch((err) => setError(userFacingError(err)));
  }, [versionCode, canManage]);

  const reload = async () => {
    if (!canManage) return;
    const rows = await api.examAcademy.bank.list({
      version_id: versionId || undefined,
      level_id: levelId || undefined,
      section_key: sectionKey || undefined,
      search: search || undefined,
    });
    setItems(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    if (!canManage || !versionId) return;
    reload().catch((err) => setError(userFacingError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, versionId, levelId, sectionKey]);

  if (!canManage) {
    return (
      <HskAcademyShell active="bank">
        <p className="hsk-error">Банк заданий доступен преподавателям.</p>
      </HskAcademyShell>
    );
  }

  const create = async () => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.examAcademy.bank.create({
        version_id: versionId,
        level_id: levelId,
        section_key: form.section_key,
        topic: form.topic || null,
        difficulty: Number(form.difficulty) || 1,
        stem: form.stem,
        explanation: form.explanation || null,
        options: form.options.filter((o) => o.text.trim()),
        vocabulary: form.vocabulary.filter((v) => v.word.trim()),
        publish: Boolean(form.publish),
      });
      setForm(emptyForm());
      setOk('Задание создано');
      await reload();
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HskAcademyShell active="bank">
      <section className="hsk-hero">
        <p className="hsk-kicker">Content Bank</p>
        <h1>Банк заданий</h1>
        <p className="hsk-lead">Создавайте оригинальные задания Longhua с метаданными и словарём.</p>
      </section>

      <div className="hsk-panel">
        <h2>Фильтры</h2>
        <div className="hsk-form-grid">
          <label>
            Версия
            <select value={versionCode} onChange={(e) => setVersionCode(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.code}>{v.title}</option>
              ))}
            </select>
          </label>
          <label>
            Уровень
            <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
          <label>
            Раздел
            <select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
              <option value="">Все</option>
              <option value="listening">Аудирование</option>
              <option value="reading">Чтение</option>
              <option value="writing">Письмо</option>
            </select>
          </label>
          <label>
            Поиск
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') reload().catch((err) => setError(userFacingError(err)));
              }}
              placeholder="тема или слово"
            />
          </label>
        </div>
        <div className="hsk-actions">
          <button
            type="button"
            className="hsk-btn hsk-btn--ghost"
            onClick={() => reload().catch((e) => setError(userFacingError(e)))}
          >
            Найти
          </button>
        </div>
      </div>

      <div className="hsk-panel">
        <h2>Новое задание</h2>
        <div className="hsk-form-grid">
          <label className="hsk-span-2">
            Условие
            <textarea rows={3} value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} />
          </label>
          <label>
            Раздел
            <select value={form.section_key} onChange={(e) => setForm({ ...form, section_key: e.target.value })}>
              <option value="reading">Чтение</option>
              <option value="listening">Аудирование</option>
              <option value="writing">Письмо</option>
            </select>
          </label>
          <label>
            Тема
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </label>
          <label>
            Сложность
            <input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
          </label>
          <label className="hsk-span-2">
            Объяснение
            <textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </label>
        </div>
        <h3 className="hsk-subhead">Варианты</h3>
        {form.options.map((opt, idx) => (
          <div key={idx} className="hsk-inline-row">
            <input
              value={opt.text}
              placeholder={`Вариант ${idx + 1}`}
              onChange={(e) => {
                const options = [...form.options];
                options[idx] = { ...options[idx], text: e.target.value };
                setForm({ ...form, options });
              }}
            />
            <label className="hsk-check">
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
        <h3 className="hsk-subhead">Слова</h3>
        {form.vocabulary.map((v, idx) => (
          <div key={idx} className="hsk-inline-row hsk-vocab-row">
            <input
              placeholder="汉字"
              value={v.word}
              onChange={(e) => {
                const vocabulary = [...form.vocabulary];
                vocabulary[idx] = { ...vocabulary[idx], word: e.target.value };
                setForm({ ...form, vocabulary });
              }}
            />
            <input
              placeholder="pinyin"
              value={v.pinyin}
              onChange={(e) => {
                const vocabulary = [...form.vocabulary];
                vocabulary[idx] = { ...vocabulary[idx], pinyin: e.target.value };
                setForm({ ...form, vocabulary });
              }}
            />
            <input
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
        <button
          type="button"
          className="hsk-btn hsk-btn--ghost hsk-btn--sm"
          onClick={() => setForm({ ...form, vocabulary: [...form.vocabulary, { word: '', pinyin: '', translation: '' }] })}
        >
          + слово
        </button>
        <label className="hsk-check" style={{ marginTop: '0.75rem' }}>
          <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          Опубликовать сразу
        </label>
        {error ? <p className="hsk-error">{error}</p> : null}
        {ok ? <p className="hsk-muted">{ok}</p> : null}
        <div className="hsk-actions">
          <button type="button" className="hsk-btn" disabled={busy || !form.stem.trim()} onClick={create}>
            {busy ? 'Создание…' : 'Создать задание'}
          </button>
        </div>
      </div>

      <div className="hsk-panel">
        <h2>Список ({items.length})</h2>
        {items.length === 0 ? (
          <p className="hsk-muted">Пока нет заданий по фильтру.</p>
        ) : (
          <ul className="hsk-list">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.topic || item.sectionKey || item.section_key}</strong>
                  <div className="hsk-muted">
                    {STATUS_RU[item.status] || item.status}
                    {' · '}rev {item.revision}
                    {' · '}{item.itemTypeCode || item.item_type_code}
                    {(item.vocabulary || []).length
                      ? ` · ${(item.vocabulary || []).map((v) => v.word).filter(Boolean).join(', ')}`
                      : ''}
                  </div>
                </div>
                <div className="hsk-inline-actions">
                  {item.status !== 'published' && item.status !== 'archived' ? (
                    <button
                      type="button"
                      className="hsk-btn hsk-btn--ghost hsk-btn--sm"
                      onClick={() =>
                        api.examAcademy.bank
                          .publish(item.id)
                          .then(reload)
                          .catch((e) => setError(userFacingError(e)))
                      }
                    >
                      Опубликовать
                    </button>
                  ) : null}
                  {item.status !== 'archived' ? (
                    <button
                      type="button"
                      className="hsk-btn hsk-btn--ghost hsk-btn--sm"
                      onClick={() => {
                        if (!window.confirm('Архивировать задание?')) return;
                        api.examAcademy.bank
                          .archive(item.id)
                          .then(reload)
                          .catch((e) => setError(userFacingError(e)));
                      }}
                    >
                      В архив
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HskAcademyShell>
  );
}
