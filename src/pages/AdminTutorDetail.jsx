import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  User,
  Users,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import {
  localizeEntityStatus,
  localizeLessonStatus,
} from '@/lib/locale-by';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import StatCard from '@/components/dashboard/StatCard';

const TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'students', label: 'Ученики', icon: Users },
  { id: 'schedule', label: 'Расписание', icon: Calendar },
  { id: 'stats', label: 'Статистика', icon: BarChart3 },
];

const emptyStudentForm = { name: '', phone: '', notes: '' };

function formatDateLabel(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return format(d, 'd MMMM yyyy', { locale: ru });
  } catch {
    return String(value);
  }
}

function formatLessonDate(value) {
  if (!value) return '—';
  try {
    return format(new Date(`${value}T12:00:00`), 'd MMM yyyy', { locale: ru });
  } catch {
    return value;
  }
}

/**
 * Admin management of one tutor cabinet: profile, notebook pupils, lessons, stats.
 * Notebook pupils stay isolated from school CRM Student entities.
 */
export default function AdminTutorDetail() {
  const { tutorId } = useParams();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tutor, setTutor] = useState(null);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState(null);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    status: 'pending',
    bio: '',
    teachingExperience: '',
    specialization: '',
    defaultLessonPrice: '',
    workTimeFrom: '09:00',
    workTimeTo: '21:00',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [savingStudent, setSavingStudent] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState(null);

  const load = useCallback(async () => {
    if (!tutorId) return;
    setLoading(true);
    setError('');
    try {
      const [t, s, l, st] = await Promise.all([
        api.tutors.get(tutorId),
        api.tutors.students(tutorId),
        api.tutors.lessons(tutorId),
        api.tutors.stats(tutorId),
      ]);
      setTutor(t);
      setStudents(Array.isArray(s) ? s : []);
      setLessons(Array.isArray(l) ? l : []);
      setStats(st);
      setProfileForm({
        displayName: t?.display_name || t?.displayName || '',
        email: t?.email || '',
        phone: t?.phone || '',
        status: t?.status || 'pending',
        bio: t?.bio || '',
        teachingExperience: t?.teaching_experience || t?.teachingExperience || '',
        specialization: t?.specialization || '',
        defaultLessonPrice:
          t?.default_lesson_price != null || t?.defaultLessonPrice != null
            ? String(t.default_lesson_price ?? t.defaultLessonPrice)
            : '',
        workTimeFrom: String(t?.work_time_from || t?.workTimeFrom || '09:00').slice(0, 5),
        workTimeTo: String(t?.work_time_to || t?.workTimeTo || '21:00').slice(0, 5),
      });
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить кабинет репетитора');
      setTutor(null);
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!tutorId) return;
    setSavingProfile(true);
    try {
      await api.tutors.update(tutorId, {
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
        status: profileForm.status,
        bio: profileForm.bio.trim() || null,
        teachingExperience: profileForm.teachingExperience.trim() || null,
        specialization: profileForm.specialization.trim() || null,
        workTimeFrom: profileForm.workTimeFrom || null,
        workTimeTo: profileForm.workTimeTo || null,
        defaultLessonPrice: profileForm.defaultLessonPrice === ''
          ? null
          : Number(profileForm.defaultLessonPrice),
      });
      toast({ title: 'Профиль сохранён' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось сохранить профиль',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const openCreateStudent = () => {
    setEditingStudent(null);
    setStudentForm(emptyStudentForm);
    setStudentFormOpen(true);
  };

  const openEditStudent = (row) => {
    setEditingStudent(row);
    setStudentForm({
      name: row.name || '',
      phone: row.phone || '',
      notes: row.notes || '',
    });
    setStudentFormOpen(true);
  };

  const saveStudent = async (e) => {
    e.preventDefault();
    const name = studentForm.name.trim();
    if (!name) {
      toast({ title: 'Укажите ФИО', variant: 'destructive' });
      return;
    }
    setSavingStudent(true);
    try {
      const payload = {
        name,
        phone: studentForm.phone.trim() || null,
        notes: studentForm.notes.trim() || null,
      };
      if (editingStudent?.id) {
        await api.tutors.updateStudent(tutorId, editingStudent.id, payload);
        toast({ title: 'Запись обновлена' });
      } else {
        await api.tutors.createStudent(tutorId, payload);
        toast({ title: 'Ученик добавлен в блокнот' });
      }
      setStudentFormOpen(false);
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSavingStudent(false);
    }
  };

  const deleteStudent = async (row) => {
    if (!window.confirm(`Удалить «${row.name}» из блокнота репетитора?`)) return;
    setDeletingStudentId(row.id);
    try {
      await api.tutors.deleteStudent(tutorId, row.id);
      toast({ title: 'Запись удалена' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось удалить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setDeletingStudentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !tutor) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Link to="/AdminPanel?tab=tutors" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand">
          <ArrowLeft className="w-4 h-4" /> К списку репетиторов
        </Link>
        <p className="text-sm text-red-600">{error || 'Репетитор не найден'}</p>
      </div>
    );
  }

  const displayName = tutor.display_name || tutor.displayName || 'Репетитор';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5" data-testid="admin-tutor-detail">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link
            to="/AdminPanel?tab=tutors"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Репетиторы
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{displayName}</h1>
          <p className="text-sm text-slate-500 mt-1">Личный кабинет репетитора · блокнот не связан с CRM школы</p>
        </div>
        <span className={`text-xs font-semibold self-start ${tutor.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`}>
          {localizeEntityStatus(tutor.status)}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 dark:border-slate-800 pb-px">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-900 text-brand border border-b-white dark:border-b-slate-900 border-slate-200 dark:border-slate-700 -mb-px'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && (
        <Card className="p-5 space-y-4">
          <form onSubmit={saveProfile} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>ФИО</Label>
              <Input
                value={profileForm.displayName}
                onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>О себе</Label>
              <Textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Опыт преподавания</Label>
              <Textarea
                value={profileForm.teachingExperience}
                onChange={(e) => setProfileForm((f) => ({ ...f, teachingExperience: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Специализация</Label>
              <Input
                value={profileForm.specialization}
                onChange={(e) => setProfileForm((f) => ({ ...f, specialization: e.target.value }))}
                placeholder="Китайский язык"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Рабочее время с</Label>
                <Input
                  type="time"
                  value={profileForm.workTimeFrom}
                  onChange={(e) => setProfileForm((f) => ({ ...f, workTimeFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Рабочее время до</Label>
                <Input
                  type="time"
                  value={profileForm.workTimeTo}
                  onChange={(e) => setProfileForm((f) => ({ ...f, workTimeTo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Стоимость занятия</Label>
              <Input
                type="number"
                min={0}
                value={profileForm.defaultLessonPrice}
                onChange={(e) => setProfileForm((f) => ({ ...f, defaultLessonPrice: e.target.value }))}
              />
              <p className="text-xs text-slate-400">Только хранение. Оплата не подключена.</p>
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select
                value={profileForm.status}
                onValueChange={(v) => setProfileForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="inactive">Неактивен</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-slate-500">
              Дата регистрации: {formatDateLabel(tutor.created_at || tutor.createdAt)}
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Сохранить профиль
            </Button>
          </form>
        </Card>
      )}

      {tab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Личный блокнот репетитора ({students.length})</p>
            <Button type="button" size="sm" onClick={openCreateStudent}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </div>
          {students.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">Записей в блокноте пока нет</Card>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
                    <th className="px-4 py-3">ФИО</th>
                    <th className="px-4 py-3">Телефон</th>
                    <th className="px-4 py-3">Комментарий</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{s.notes || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button type="button" variant="outline" size="sm" className="mr-2" onClick={() => openEditStudent(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          disabled={deletingStudentId === s.id}
                          onClick={() => deleteStudent(s)}
                        >
                          {deletingStudentId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Уроки этого репетитора. Не отображаются в общем расписании школы.
          </p>
          {lessons.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">Занятий пока нет</Card>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase">
                    <th className="px-4 py-3">Дата</th>
                    <th className="px-4 py-3">Время</th>
                    <th className="px-4 py-3">Ученик</th>
                    <th className="px-4 py-3">Длительность</th>
                    <th className="px-4 py-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => (
                    <tr key={lesson.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <td className="px-4 py-3">{formatLessonDate(lesson.date)}</td>
                      <td className="px-4 py-3">
                        {(lesson.start_time || lesson.startTime || '').toString().slice(0, 5)}
                      </td>
                      <td className="px-4 py-3">{lesson.student_name || lesson.studentName || '—'}</td>
                      <td className="px-4 py-3">{lesson.duration || 60} мин</td>
                      <td className="px-4 py-3">{localizeLessonStatus(lesson.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Ученики"
              value={stats?.active_students_count ?? stats?.activeStudentsCount ?? students.length}
              icon={Users}
              color="emerald"
            />
            <StatCard
              label="Занятий"
              value={stats?.completed_lessons_count ?? stats?.completedLessonsCount ?? 0}
              icon={Calendar}
              color="brand"
            />
            <StatCard
              label="Часов"
              value={stats?.teaching_hours ?? stats?.teachingHours ?? 0}
              icon={BarChart3}
              color="amber"
            />
            <StatCard
              label="Активность за месяц"
              value={`${stats?.monthly_lessons_count ?? stats?.monthlyLessonsCount ?? 0} зан. / ${stats?.monthly_teaching_hours ?? stats?.monthlyTeachingHours ?? 0} ч`}
              icon={Calendar}
              color="muted"
            />
          </div>
        </div>
      )}

      {studentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold">
                {editingStudent ? 'Изменить ученика' : 'Новый ученик'}
              </h2>
              <button
                type="button"
                onClick={() => setStudentFormOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveStudent} className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>ФИО *</Label>
                <Input
                  value={studentForm.name}
                  onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Комментарий</Label>
                <Textarea
                  value={studentForm.notes}
                  onChange={(e) => setStudentForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStudentFormOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={savingStudent}>
                  {savingStudent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Сохранить
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
