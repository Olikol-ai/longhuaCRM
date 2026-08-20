import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Loader2, Video, Plus,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { resolveLessonStudentLabel } from '@/lib/studentLabels';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isToday, isSameMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import TutorLessonModal from '@/components/tutors/TutorLessonModal';
import LessonDetailModal from '@/components/schedule/LessonDetailModal';
import RecurrenceApplyScopeDialog from '@/components/schedule/RecurrenceApplyScopeDialog';
import { lessonBelongsToSeries } from '@/lib/lessonSeriesScope';
import { toast } from '@/components/ui/use-toast';
import { isOnlineLesson, lessonVideoPath } from '@/lib/lesson-video';
import { filterScheduleListLessons } from '@/lib/scheduleListLessons';
import { OfflineSnapshotBanner } from '@/components/pwa/OfflineSnapshotBanner';
import { OFFLINE_RESOURCES, readWithOfflineFallback } from '@/lib/offline';

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
  rescheduled: 'Перенесено',
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
      className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-brand/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
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
  const [viewingLesson, setViewingLesson] = useState(null);
  const [showCompletedInList, setShowCompletedInList] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState('this');
  const [pendingCancel, setPendingCancel] = useState(null);

  const loadData = async () => {
    setLoadError(null);
    if (!user?.id) return;
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'tutor',
        resource: OFFLINE_RESOURCES.SCHEDULE,
        resourceKey: 'tutor',
        fetcher: async () => {
          const [me, allLessons, allContacts] = await Promise.all([
            api.tutors.me(),
            api.lessons.list('-date', 500),
            api.teacherStudentContacts.listMine({ ownerType: 'tutor' }),
          ]);
          return {
            tutor: me,
            lessons: (Array.isArray(allLessons) ? allLessons : []).filter((l) => l.tutor_id === me.id),
            students: (Array.isArray(allContacts) ? allContacts : []).filter((s) => s.status !== 'inactive'),
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      if (result.missing || !result.data) {
        setLoadError('Расписание пока недоступно без подключения');
        setTutor(null);
        setLessons([]);
        setStudents([]);
        return;
      }
      setTutor(result.data.tutor);
      setLessons(result.data.lessons || []);
      setStudents(result.data.students || []);
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

  const listLessons = useMemo(
    () =>
      filterScheduleListLessons(lessons, {
        includeFinal: showCompletedInList,
      }),
    [lessons, showCompletedInList],
  );

  const markLesson = async (lesson, status, completionAttendance = 'attended', applyScope) => {
    if (status === 'completed') {
      const confirmed = window.confirm(
        'Подтвердить проведение занятия?\n\nПосле подтверждения изменить отметку будет нельзя.',
      );
      if (!confirmed) return;
    }
    if (
      status === 'cancelled' &&
      lessonBelongsToSeries(lesson) &&
      applyScope === undefined
    ) {
      setPendingCancel(lesson);
      setCancelScope('this');
      setCancelScopeOpen(true);
      return;
    }
    const scope = applyScope || 'this';
    setUpdating(lesson.id);
    try {
      const payload =
        status === 'completed'
          ? { status, completion_attendance: completionAttendance }
          : { status };
      if (scope !== 'this') {
        payload.apply_scope = scope;
      }
      await api.lessons.update(lesson.id, payload);
      const series = scope === 'all' || scope === 'series';
      toast({
        title:
          status === 'completed'
            ? 'Занятие проведено'
            : status === 'cancelled'
              ? series
                ? 'Занятия серии отменены'
                : 'Урок отменён'
              : 'Статус обновлён',
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

  const handleDeleteLesson = async (id, applyScope = 'this') => {
    try {
      await api.lessons.delete(id, { apply_scope: applyScope });
      setViewingLesson(null);
      await loadData();
      toast({
        title:
          applyScope === 'all' || applyScope === 'series'
            ? 'Серия занятий удалена'
            : 'Урок удалён',
      });
    } catch (err) {
      toast({
        title: 'Не удалось удалить занятие',
        description: err?.message,
        variant: 'destructive',
      });
      throw err;
    }
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
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Расписание пока недоступно без подключения"
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Моё расписание</h1>
          <p className="text-sm text-muted-foreground mt-1">Только ваши занятия с вашими учениками</p>
        </div>
        <Button onClick={() => { setSelectedDate(format(new Date(), 'yyyy-MM-dd')); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Занятие
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button type="button" onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'week' ? 'bg-card shadow-sm' : ''}`}>Неделя</button>
          <button type="button" onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'month' ? 'bg-card shadow-sm' : ''}`}>Месяц</button>
          <button type="button" onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'list' ? 'bg-card shadow-sm' : ''}`}>Список</button>
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
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Показаны актуальные занятия. Завершённые скрыты по умолчанию.
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand rounded border-slate-300"
                checked={showCompletedInList}
                onChange={(e) => setShowCompletedInList(e.target.checked)}
                data-testid="tutor-schedule-list-show-completed"
              />
              Показать завершённые занятия
            </label>
          </div>
          {listLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              {showCompletedInList ? 'Занятий пока нет' : 'Нет актуальных занятий'}
            </p>
          ) : (
            listLessons.map((lesson) => (
              <TutorLessonCard
                key={lesson.id}
                lesson={lesson}
                students={students}
                busy={updating === lesson.id}
                onOpen={() => setViewingLesson(lesson)}
                onComplete={(l) => markLesson(l, 'completed')}
                onCancel={(l) => markLesson(l, 'cancelled')}
              />
            ))
          )}
        </div>
      ) : (
        <>
          <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-1 sm:gap-2`}>
            {WEEK_DAYS_RU.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
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
                    isToday(day) ? 'border-brand bg-brand-soft/40' : 'border-border bg-card'
                  } ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1">{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayLessons.slice(0, 3).map((l) => (
                      <div key={l.id} className={`h-1.5 rounded-full ${STATUS_BG[l.status] || 'bg-slate-300'}`} title={STATUS_LABELS[l.status]} />
                    ))}
                    {dayLessons.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayLessons.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {format(new Date(`${selectedDay}T12:00:00`), 'd MMMM yyyy', { locale: ru })}
                </h2>
                <Button size="sm" onClick={() => { setSelectedDate(selectedDay); setShowModal(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
                </Button>
              </div>
              {getLessonsForDay(selectedDay).length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет занятий</p>
              ) : getLessonsForDay(selectedDay).map((lesson) => (
                <TutorLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  students={students}
                  busy={updating === lesson.id}
                  onOpen={() => setViewingLesson(lesson)}
                  onComplete={(l) => markLesson(l, 'completed')}
                  onCancel={(l) => markLesson(l, 'cancelled')}
                />
              ))}
            </div>
          )}
        </>
      )}

      {viewingLesson ? (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={[]}
          students={[]}
          contacts={students}
          isAdmin={false}
          isTeacher={false}
          isTutor
          onUpdate={async (id, data) => {
            await api.lessons.update(id, data);
            const series =
              data?.apply_scope === 'all' ||
              data?.apply_scope === 'series' ||
              data?.applyScope === 'all' ||
              data?.applyScope === 'series';
            toast({
              title:
                data?.status === 'cancelled'
                  ? series
                    ? 'Занятия серии отменены'
                    : 'Урок отменён'
                  : 'Занятие обновлено',
            });
            await loadData();
            setViewingLesson(null);
          }}
          onDelete={handleDeleteLesson}
          onStudentsUpdated={(updated) => {
            setViewingLesson(updated);
            setLessons((prev) =>
              prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
            );
          }}
          onClose={() => setViewingLesson(null)}
        />
      ) : null}

      <RecurrenceApplyScopeDialog
        open={cancelScopeOpen}
        mode="status"
        value={cancelScope}
        onChange={setCancelScope}
        title="Отменить:"
        confirmLabel="Отменить"
        onCancel={() => {
          setCancelScopeOpen(false);
          setPendingCancel(null);
        }}
        onConfirm={() => {
          if (!pendingCancel) return;
          const lesson = pendingCancel;
          setCancelScopeOpen(false);
          setPendingCancel(null);
          void markLesson(lesson, 'cancelled', 'attended', cancelScope);
        }}
      />

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
