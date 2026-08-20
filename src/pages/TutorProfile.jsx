import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Loader2, User, BookOpen, Clock, Plus, X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import AvatarEditor from '@/components/user/AvatarEditor';

const TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'directions', label: 'Направления обучения', icon: BookOpen },
  { id: 'settings', label: 'Настройки занятий', icon: Clock },
];

const DURATION_OPTIONS = [30, 60, 90, 120];
const WEEK_DAYS = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
];

function listNames(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => (typeof r === 'string' ? r : r?.name))
    .filter(Boolean);
}

function listMinutes(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => Number(typeof r === 'number' ? r : r?.minutes))
    .filter((n) => DURATION_OPTIONS.includes(n));
}

function listDays(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => Number(typeof r === 'number' ? r : r?.day_of_week ?? r?.dayOfWeek))
    .filter((n) => n >= 0 && n <= 6);
}

function TagListEditor({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (values.includes(name)) {
      setDraft('');
      return;
    }
    onChange([...values, name]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
          >
            {name}
            <button
              type="button"
              className="text-muted-foreground hover:text-red-500"
              onClick={() => onChange(values.filter((v) => v !== name))}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Tutor self-service profile: personal data, teaching directions, lesson settings.
 * Admin can edit the same fields via PATCH /tutors/:id.
 */
export default function TutorProfile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tutorId, setTutorId] = useState(null);
  const [form, setForm] = useState({
    displayName: '',
    phone: '',
    bio: '',
    teachingExperience: '',
    specialization: '',
    learningDirections: [],
    teachingLanguages: [],
    lessonDurations: [60],
    workDays: [0, 1, 2, 3, 4],
    workTimeFrom: '09:00',
    workTimeTo: '21:00',
    defaultLessonPrice: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await api.tutors.me();
      setTutorId(me.id);
      setForm({
        displayName: me.display_name || me.displayName || '',
        phone: me.phone || '',
        bio: me.bio || '',
        teachingExperience: me.teaching_experience || me.teachingExperience || '',
        specialization: me.specialization || '',
        learningDirections: listNames(me.learning_directions || me.learningDirections),
        teachingLanguages: listNames(me.teaching_languages || me.teachingLanguages),
        lessonDurations: listMinutes(me.lesson_durations || me.lessonDurations).length
          ? listMinutes(me.lesson_durations || me.lessonDurations)
          : [60],
        workDays: listDays(me.work_days || me.workDays).length
          ? listDays(me.work_days || me.workDays)
          : [0, 1, 2, 3, 4],
        workTimeFrom: String(me.work_time_from || me.workTimeFrom || '09:00').slice(0, 5),
        workTimeTo: String(me.work_time_to || me.workTimeTo || '21:00').slice(0, 5),
        defaultLessonPrice:
          me.default_lesson_price != null || me.defaultLessonPrice != null
            ? String(me.default_lesson_price ?? me.defaultLessonPrice)
            : '',
      });
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const priceHint = useMemo(
    () => 'Только хранение. Оплата и сплит-платежи будут подключены позже.',
    [],
  );

  const save = async (e) => {
    e.preventDefault();
    if (!tutorId) return;
    if (!form.displayName.trim()) {
      toast({ title: 'Укажите ФИО', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.tutors.update(tutorId, {
        displayName: form.displayName.trim(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        teachingExperience: form.teachingExperience.trim() || null,
        specialization: form.specialization.trim() || null,
        learningDirections: form.learningDirections,
        teachingLanguages: form.teachingLanguages,
        lessonDurations: form.lessonDurations,
        workDays: form.workDays,
        workTimeFrom: form.workTimeFrom || null,
        workTimeTo: form.workTimeTo || null,
        defaultLessonPrice: form.defaultLessonPrice === ''
          ? null
          : Number(form.defaultLessonPrice),
      });
      toast({ title: 'Профиль сохранён' });
      await load();
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

  const toggleDuration = (minutes) => {
    setForm((f) => {
      const has = f.lessonDurations.includes(minutes);
      const next = has
        ? f.lessonDurations.filter((d) => d !== minutes)
        : [...f.lessonDurations, minutes].sort((a, b) => a - b);
      return { ...f, lessonDurations: next.length ? next : [60] };
    });
  };

  const toggleWorkDay = (day) => {
    setForm((f) => {
      const has = f.workDays.includes(day);
      const next = has
        ? f.workDays.filter((d) => d !== day)
        : [...f.workDays, day].sort((a, b) => a - b);
      return { ...f, workDays: next };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5" data-testid="tutor-profile-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Профиль</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ваши данные и настройки работы. Администратор также может их редактировать.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg ${
                active
                  ? 'bg-card text-brand border border-b-white dark:border-b-slate-900 border-border -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={save} className="space-y-5">
        {tab === 'profile' && (
          <Card className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Фотография</Label>
              <AvatarEditor user={user} sizeClass="h-20 w-20" />
            </div>
            <div className="space-y-2">
              <Label>ФИО *</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+375…"
              />
            </div>
            <div className="space-y-2">
              <Label>О себе</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="Коротко расскажите о себе"
              />
            </div>
            <div className="space-y-2">
              <Label>Опыт преподавания</Label>
              <Textarea
                value={form.teachingExperience}
                onChange={(e) => setForm((f) => ({ ...f, teachingExperience: e.target.value }))}
                rows={3}
                placeholder="Например: 5 лет преподавания китайского"
              />
            </div>
          </Card>
        )}

        {tab === 'directions' && (
          <Card className="p-5 space-y-5">
            <div className="space-y-2">
              <Label>Специализация</Label>
              <Input
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                placeholder="Китайский язык"
              />
            </div>
            <div className="space-y-2">
              <Label>Направления</Label>
              <TagListEditor
                values={form.learningDirections}
                onChange={(learningDirections) => setForm((f) => ({ ...f, learningDirections }))}
                placeholder="HSK, разговорный китайский…"
              />
            </div>
            <div className="space-y-2">
              <Label>Языки преподавания</Label>
              <TagListEditor
                values={form.teachingLanguages}
                onChange={(teachingLanguages) => setForm((f) => ({ ...f, teachingLanguages }))}
                placeholder="Русский, английский…"
              />
            </div>
          </Card>
        )}

        {tab === 'settings' && (
          <Card className="p-5 space-y-5">
            <div className="space-y-2">
              <Label>Длительность занятий</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((minutes) => {
                  const active = form.lessonDurations.includes(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => toggleDuration(minutes)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        active
                          ? 'bg-brand text-white border-brand'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {minutes} мин
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Рабочие дни</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WEEK_DAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.workDays.includes(day.value)}
                      onChange={() => toggleWorkDay(day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Рабочее время с</Label>
                <Input
                  type="time"
                  value={form.workTimeFrom}
                  onChange={(e) => setForm((f) => ({ ...f, workTimeFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Рабочее время до</Label>
                <Input
                  type="time"
                  value={form.workTimeTo}
                  onChange={(e) => setForm((f) => ({ ...f, workTimeTo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Стоимость занятия</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.defaultLessonPrice}
                onChange={(e) => setForm((f) => ({ ...f, defaultLessonPrice: e.target.value }))}
                placeholder="BYN"
              />
              <p className="text-xs text-muted-foreground">{priceHint}</p>
            </div>
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">Материалы репетитора</p>
              <p className="text-xs text-muted-foreground mt-1">
                Архитектура готова (название, описание, ссылка/файл). Раздел будет расширен позже.
              </p>
            </div>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </div>
      </form>
    </div>
  );
}
