import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Loader2, Video, Plus,
  CheckCircle2, XCircle, Calendar, List,
} from 'lucide-react';
import { resolveLessonStudentLabel } from '@/lib/studentLabels';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth, addDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import TutorLessonModal from '@/components/tutors/TutorLessonModal';
import { toast } from '@/components/ui/use-toast';
import { isOnlineLesson, lessonVideoPath } from '@/lib/lesson-video';

const STATUS_BG = {
  planned: 'bg-brand',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  rescheduled: 'bg-amber-500',
  missed: 'bg-orange-400',
  missed_no_notice: 'bg-red-700',
};
const STATUS_LABELS = {
  planned: 'Запланировано',
  completed: 'Проведено',
  cancelled: 'Отменено',
  missed: 'Пропущено',
  missed_no_notice: 'Без предупреждения',
};
const WEEK_DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function TutorLessonCard({ lesson, students, onOpen, onComplete, onCancel, busy }) {
  const label = resolveLessonStudentLabel(lesson, students);
  return (
    <button
      type="button"
      onClick={() => onOpen(lesson)}
      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:border-brand/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {(lesson.start_time || '').slice(0, 5)} · {lesson.duration || 60} мин
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {STATUS_LABELS[lesson.status] || lesson.status}
        </Badge>
      </div>
      {lesson.status === 'planned' && (
        <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onComplete(lesson)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Провести
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(lesson)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Отменить
          </Button>
        </div>
      )}
      {isOnlineLesson(lesson) && (
        <a
          href={lessonVideoPath(lesson.id)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-brand"
          onClick={(e) => e.stopPropagation()}
        >
          <Video className="w-3 h-3" /> Начать видеоурок
        </a>
      )}
    </button>
  );
}

export default function TutorSchedule() {
  const { user } = useAuth();
  const [tutor, setTutor] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const loadData = async () => {
    setLoadError(null);
    try {
      const [me, allLessons, allStudents] = await Promise.all([
        api.tutors.me(),
        api.lessons.list('-date', 500),
        api.teacherStudentContacts.listMine({ ownerType: 'tutor' }),
      ]);
      setTutor(me);
      // Backend already scopes; keep client filter for safety.
      setLessons((Array.isArray(allLessons) ? allLessons : []).filter((l) => l.tutor_id === me.id));
      setStudents((Array.isArray(allStudents) ? allStudents : []).filter((s) => s.status !== 'inactive'));
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить расписание');
      setTutor(null);
      setLessons([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const getLessonsForDay = (dateStr) =>
    lessons.filter((l) => l.date === dateStr).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const markLesson = async (lesson, status, completionAttendance = 'attended') => {
    if (status === 'completed') {
      const confirmed = window.confirm(
        'Подтвердить проведение занятия?\n\nПосле подтверждения изменить отметку будет нельзя.',
      );
      if (!confirmed) return;
    }
    setUpdating(lesson.id);
    try {
      const payload =
        status === 'completed'
          ? { status, completion_attendance: completionAttendance }
          : { status };
      await api.lessons.update(lesson.id, payload);
      toast({
        title: status === 'completed' ? 'Занятие проведено' : 'Статус обновлён',
      });
      await loadData();
    } catch (err) {
      toast({
        title: 'Не удалось обновить занятие',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleCreate = async (payload) => {
    await api.lessons.create(payload);
    toast({ title: 'Занятие создано' });
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return <div className="p-6 text-sm text-red-600">{loadError}</div>;
  }

  const days = viewMode === 'month' ? monthDays : weekDays;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Моё расписание</h1>
          <p className="text-sm text-slate-500 mt-1">Только ваши занятия с вашими учениками</p>
        </div>
        <Button onClick={() => { setSelectedDate(format(new Date(), 'yyyy-MM-dd')); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Занятие
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button type="button" onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'week' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}`}>Неделя</button>
          <button type="button" onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'month' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}`}>Месяц</button>
          <button type="button" onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}`}>Список</button>
        </div>
        {viewMode !== 'list' && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[9rem] text-center">
              {format(currentDate, viewMode === 'month' ? 'LLLL yyyy' : 'd MMM yyyy', { locale: ru })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-2">
          {lessons.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Занятий пока нет</p>
          ) : lessons.map((lesson) => (
            <TutorLessonCard
              key={lesson.id}
              lesson={lesson}
              students={students}
              busy={updating === lesson.id}
              onOpen={() => setSelectedDay(lesson.date)}
              onComplete={(l) => markLesson(l, 'completed')}
              onCancel={(l) => markLesson(l, 'cancelled')}
            />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-1 sm:gap-2`}>
            {WEEK_DAYS_RU.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayLessons = getLessonsForDay(dateStr);
              const inMonth = viewMode === 'week' || isSameMonth(day, currentDate);
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDay(dateStr);
                    if (dayLessons.length === 0) {
                      setSelectedDate(dateStr);
                      setShowModal(true);
                    }
                  }}
                  className={`min-h-[5.5rem] sm:min-h-[7rem] rounded-xl border p-1.5 text-left transition-colors ${
                    isToday(day) ? 'border-brand bg-brand-soft/40' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                  } ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayLessons.slice(0, 3).map((l) => (
                      <div key={l.id} className={`h-1.5 rounded-full ${STATUS_BG[l.status] || 'bg-slate-300'}`} title={STATUS_LABELS[l.status]} />
                    ))}
                    {dayLessons.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{dayLessons.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {format(new Date(`${selectedDay}T12:00:00`), 'd MMMM yyyy', { locale: ru })}
                </h2>
                <Button size="sm" onClick={() => { setSelectedDate(selectedDay); setShowModal(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
                </Button>
              </div>
              {getLessonsForDay(selectedDay).length === 0 ? (
                <p className="text-sm text-slate-400">Нет занятий</p>
              ) : getLessonsForDay(selectedDay).map((lesson) => (
                <TutorLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  students={students}
                  busy={updating === lesson.id}
                  onOpen={() => {}}
                  onComplete={(l) => markLesson(l, 'completed')}
                  onCancel={(l) => markLesson(l, 'cancelled')}
                />
              ))}
            </div>
          )}
        </>
      )}

      <TutorLessonModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
        students={students}
        tutorId={tutor?.id}
        tutor={tutor}
        defaultDate={selectedDate}
      />
    </div>
  );
}
