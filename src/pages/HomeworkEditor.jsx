import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';

const ACTIVITY_OPTIONS = [
  { value: 'test', label: 'Тест' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking (скоро)' },
  { value: 'writing', label: 'Writing (скоро)' },
];

export default function HomeworkEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    activity_kind: 'test',
    pass_score_percent: 60,
    selectedQuestionIds: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const qs = await api.assessment.listQuestions({ status: 'published', limit: 200 });
        const rows = Array.isArray(qs) ? qs : qs?.items || [];
        setQuestions(rows);

        if (id) {
          const hw = await api.homework.get(id);
          setForm({
            title: hw.title || '',
            description: hw.description || '',
            instructions: hw.instructions || '',
            activity_kind: hw.activity_kind || 'test',
            pass_score_percent: hw.pass_score_percent ?? 60,
            selectedQuestionIds: (hw.items || []).map((i) => i.question_id),
          });
        }
      } catch (err) {
        toast({
          title: 'Ошибка загрузки',
          description: userFacingError(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleQuestion = (qid) => {
    setForm((f) => {
      const set = new Set(f.selectedQuestionIds);
      if (set.has(qid)) set.delete(qid);
      else set.add(qid);
      return { ...f, selectedQuestionIds: [...set] };
    });
  };

  const handleSave = async (publishAfter = false) => {
    if (!form.title.trim() || form.title.trim().length < 2) {
      toast({ title: 'Укажите название', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        activity_kind: form.activity_kind,
        pass_score_percent: Number(form.pass_score_percent) || 60,
        items: form.selectedQuestionIds.map((question_id, idx) => ({
          question_id,
          section_key: form.activity_kind === 'listening' ? 'listening'
            : form.activity_kind === 'reading' ? 'reading'
            : 'test',
          sort_order: idx,
        })),
      };
      let hwId = id;
      if (id) {
        await api.homework.update(id, payload);
      } else {
        const created = await api.homework.create(payload);
        hwId = created.id;
      }
      if (publishAfter) {
        await api.homework.publish(hwId);
        toast({ title: 'Задание опубликовано' });
      } else {
        toast({ title: 'Сохранено' });
      }
      navigate(createPageUrl('HomeworkList'));
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6" data-testid="homework-editor">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {id ? 'Редактирование задания' : 'Новое домашнее задание'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Вопросы берутся из ваших опубликованных вопросов (тест / reading / listening)
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Название</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg"
            data-testid="homework-title"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Описание</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-sm border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Инструкция (Markdown)</label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            rows={4}
            placeholder={'Прочитайте текст.\nПрослушайте аудио.\nОтветьте на вопросы.'}
            className="w-full px-3 py-2 text-sm border rounded-lg font-mono"
            data-testid="homework-instructions"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Тип</label>
            <select
              value={form.activity_kind}
              onChange={(e) => setForm((f) => ({ ...f, activity_kind: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={o.value === 'speaking' || o.value === 'writing'}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Проходной %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.pass_score_percent}
              onChange={(e) => setForm((f) => ({ ...f, pass_score_percent: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Мои вопросы ({questions.length})</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Нет доступных вопросов. Создайте их в разделе «Мои вопросы».
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {questions.map((q) => (
              <label
                key={q.id}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.selectedQuestionIds.includes(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="text-[10px] uppercase text-slate-400 mr-2">{q.type}</span>
                  {q.stem?.slice(0, 120)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(createPageUrl('HomeworkList'))}>
          Отмена
        </Button>
        <Button disabled={saving} onClick={() => handleSave(false)} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
        <Button disabled={saving} onClick={() => handleSave(true)} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Сохранить и опубликовать
        </Button>
      </div>
    </div>
  );
}
