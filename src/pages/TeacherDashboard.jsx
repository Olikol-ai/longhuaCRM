import React, { useState, useEffect, useMemo } from "react";
import MaterialPickerDialog from "@/components/materials/MaterialPickerDialog";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { formatWelcomeGreeting, getGreetingName } from '@/lib/display-name';
import { resolveLessonStudentLabel } from '@/lib/studentLabels';
import { inviteUrlFromResponse, inviteUrlFromRow, isActiveInvite } from '@/lib/invite-links';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, CheckCircle2, XCircle, Clock, Loader2, DollarSign, Link2, Copy, Video } from "lucide-react";
import { Button } from "@/design-system";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/dashboard/StatCard";
import { toast } from "@/components/ui/use-toast";
import { formatBYN } from "@/lib/formatters";
import { filterLessonsWithinNext48Hours } from "@/lib/teacherUpcomingLessons";
import {
  computeCompletedLessonsMonthStats,
  formatCompletedMonthComparison,
} from "@/lib/completedLessonsMonthStats";
import { isOnlineLesson, lessonVideoPath } from "@/lib/lesson-video";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RecurrenceApplyScopeDialog from "@/components/schedule/RecurrenceApplyScopeDialog";
import { lessonBelongsToSeries } from "@/lib/lessonSeriesScope";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [paymentPeriods, setPaymentPeriods] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState("this");
  const [pendingCancelLesson, setPendingCancelLesson] = useState(null);

  const activeInvites = useMemo(
    () => invites.filter(isActiveInvite),
    [invites],
  );

  const loadData = async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const [allTeachers, allLessons, allStudents, myPeriods, myInvites] = await Promise.all([
        api.teachers.list(),
        api.lessons.list("-date", 200),
        api.students.list(),
        api.teacherPayments.myPeriods().catch(() => []),
        api.teacherInvites.list().catch(() => []),
      ]);
      const t = allTeachers.find((x) => x.user_id === user.id || x.email === user.email);
      setTeacher(t);
      if (t) {
        setLessons(allLessons.filter((l) => l.teacher_id === t.id));
        setStudents(
          allStudents.filter(
            (s) =>
              s.assigned_teacher === t.id
              && s.status !== 'inactive'
              && (s.user_role == null || s.user_role === 'student' || s.userRole === 'student'),
          ),
        );
      } else {
        setLessons([]);
        setStudents([]);
      }
      setPaymentPeriods(Array.isArray(myPeriods) ? myPeriods : []);
      const inviteRows = Array.isArray(myInvites) ? myInvites : [];
      setInvites(inviteRows);
      const active = inviteRows.find(isActiveInvite);
      setLatestInviteUrl(active ? inviteUrlFromRow(active) : '');
    } catch (err) {
      setLoadError(err?.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  /** Idempotent: server returns the single active link (creates only if missing). */
  const handleEnsureInvite = async () => {
    setInviteBusy(true);
    try {
      const ensured = await api.teacherInvites.create();
      const url = inviteUrlFromResponse(ensured);
      setLatestInviteUrl(url);
      if (ensured?.created) {
        toast({ title: "Ссылка приглашения создана" });
      } else {
        toast({ title: "Ссылка уже существует" });
      }
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось получить ссылку",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    let url = latestInviteUrl;
    if (!url) {
      setInviteBusy(true);
      try {
        const ensured = await api.teacherInvites.create();
        url = inviteUrlFromResponse(ensured);
        setLatestInviteUrl(url);
        await loadData();
      } catch (err) {
        toast({
          title: "Не удалось получить ссылку",
          description: err?.message,
          variant: "destructive",
        });
        return;
      } finally {
        setInviteBusy(false);
      }
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Скопируйте ссылку вручную", description: url });
    }
  };

  const handleRevokeInvite = async (id) => {
    try {
      // Optimistic UI: hide immediately, then sync with server.
      setInvites((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, revoked_at: new Date().toISOString() } : row,
        ),
      );
      setLatestInviteUrl('');
      await api.teacherInvites.revoke(id);
      toast({ title: "Ссылка отозвана" });
      await loadData();
    } catch (err) {
      await loadData();
      toast({
        title: "Не удалось отозвать ссылку",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkComplete = async (lesson, materialIds = []) => {
    setActionBusy(true);
    try {
      await api.lessons.update(lesson.id, { status: "completed", material_ids: materialIds });
      setConfirmAction(null);
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось завершить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkCancelled = async (lesson, applyScope = "this") => {
    setActionBusy(true);
    try {
      const payload = { status: "cancelled" };
      if (applyScope && applyScope !== "this") {
        payload.apply_scope = applyScope;
      }
      await api.lessons.update(lesson.id, payload);
      setConfirmAction(null);
      const series = applyScope === "all" || applyScope === "series";
      toast({
        title: series ? "Занятия серии отменены" : "Урок отменён",
      });
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось отменить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setActionBusy(false);
    }
  };

  const beginCancel = (lesson) => {
    setConfirmAction(null);
    if (lessonBelongsToSeries(lesson)) {
      setPendingCancelLesson(lesson);
      setCancelScope("this");
      setCancelScopeOpen(true);
      return;
    }
    void handleMarkCancelled(lesson, "this");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20 space-y-3">
        <p className="text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => { setLoading(true); loadData(); }}>
          Повторить
        </Button>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20">
        <p className="text-muted-foreground">Профиль преподавателя не найден для вашего аккаунта.</p>
        <p className="text-xs text-muted-foreground mt-2">Обратитесь к администратору.</p>
      </div>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLessons = lessons.filter((l) => l.date === todayStr && l.status !== "cancelled");
  const upcomingLessons = filterLessonsWithinNext48Hours(lessons);
  const completedMonth = formatCompletedMonthComparison(
    computeCompletedLessonsMonthStats(lessons),
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {formatWelcomeGreeting(
              getGreetingName(teacher) ? teacher : getGreetingName(user) ? user : null,
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Уроков сегодня" value={todayLessons.length} icon={Calendar} color="brand" />
        <StatCard title="Предстоящие" value={upcomingLessons.length} icon={Clock} color="muted" />
        <StatCard
          title={completedMonth.label}
          value={completedMonth.value}
          icon={CheckCircle2}
          color="emerald"
          previousLine={completedMonth.previousLine}
          trendLine={completedMonth.trendLine}
          trendTone={completedMonth.trendTone}
        />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">Приглашение учеников</h2>
      <Card className="p-4 mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          Одна постоянная ссылка для учеников. После регистрации и подтверждения email ученик автоматически закрепится за вами.
        </p>
        <div className="flex flex-wrap gap-2">
          {!latestInviteUrl && (
            <Button
              onClick={handleEnsureInvite}
              disabled={inviteBusy}
              className="bg-primary hover:bg-primary/90 gap-2"
              data-testid="teacher-invite-create"
            >
              {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Получить ссылку
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyInvite}
            disabled={inviteBusy}
            className="gap-2"
            data-testid="teacher-invite-copy"
          >
            <Copy className="h-4 w-4" />
            Скопировать ссылку
          </Button>
        </div>
        {latestInviteUrl && (
          <p className="text-xs break-all text-brand dark:text-brand" data-testid="teacher-invite-url">
            {latestInviteUrl}
          </p>
        )}
        {activeInvites.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {activeInvites.slice(0, 5).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <Badge variant="default">Активна</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    до {format(new Date(row.expires_at), "dd.MM.yyyy")} · реферальных учеников: {row.active_students_count ?? row.activeStudentsCount ?? row.use_count ?? 0}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRevokeInvite(row.id)}>
                  Отозвать
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h2 className="text-lg font-semibold text-foreground mb-4">Мои выплаты</h2>
      {paymentPeriods.length === 0 ? (
        <Card className="p-6 text-center border-dashed mb-8">
          <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Начислений пока нет</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {paymentPeriods.map((period) => {
            const payoutDate = period.payoutDate || period.payout_date;
            let payoutHint = null;
            if (payoutDate) {
              try {
                payoutHint = format(new Date(`${payoutDate}T00:00:00`), "d MMMM yyyy", {
                  locale: ru,
                });
              } catch {
                payoutHint = payoutDate;
              }
            }
            return (
              <Card key={period.key || period.month} className="p-4">
                <p className="text-sm font-medium text-foreground">
                  {period.label}
                </p>
                {payoutHint ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    К выплате {payoutHint}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-2">Начислено:</p>
                <p className="font-semibold text-foreground flex items-center gap-2 mt-1">
                  <span className="tabular-nums whitespace-nowrap">{formatBYN(period.amount)}</span>
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold text-foreground mb-4">Предстоящие уроки</h2>
      {upcomingLessons.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">В ближайшие два дня занятий нет.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingLessons.map((lesson) => (
            <Card key={lesson.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                           <div className="text-center min-w-[60px]">
                             <p className="text-xs text-muted-foreground">{format(new Date(lesson.date), "d MMM", { locale: ru })}</p>
                             <p className="text-lg font-bold text-foreground">{lesson.start_time}</p>
                             <p className="text-[11px] text-muted-foreground">{lesson.duration || 60} min</p>
                           </div>
                           <div>
                             <p className="font-medium text-foreground">{resolveLessonStudentLabel(lesson, students)}</p>
                    {isOnlineLesson(lesson) && (
                      <a
                        href={lessonVideoPath(lesson.id)}
                        className="text-xs text-brand dark:text-brand hover:underline inline-flex items-center gap-1"
                      >
                        <Video className="h-3 w-3" />
                        Начать видеоурок →
                      </a>
                    )}
                    {lesson.notes && <p className="text-xs text-muted-foreground mt-1">{lesson.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction({ type: "cancel", lesson })}
                    className="text-red-600 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Отменить
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setConfirmAction({ type: "complete", lesson }); setShowMaterialPicker(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Завершить
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showMaterialPicker && confirmAction?.type === "complete" && (
        <MaterialPickerDialog
          lessonInfo={`${resolveLessonStudentLabel(confirmAction.lesson, students)} · ${confirmAction.lesson.date} ${confirmAction.lesson.start_time}`}
          onConfirm={(materialIds) => {
            handleMarkComplete(confirmAction.lesson, materialIds);
            setShowMaterialPicker(false);
            setConfirmAction(null);
          }}
          onSkip={() => {
            handleMarkComplete(confirmAction.lesson, []);
            setShowMaterialPicker(false);
            setConfirmAction(null);
          }}
          onCancel={() => { setShowMaterialPicker(false); setConfirmAction(null); }}
        />
      )}

      <AlertDialog open={!!confirmAction && !showMaterialPicker} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "complete" ? "Отметить урок как завершённый?" : "Отменить урок?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "complete"
                ? "Урок будет отмечен как завершённый, а баланс ученика уменьшится на 1."
                : "Урок будет отменён. Баланс ученика не изменится."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Назад</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={() =>
                confirmAction?.type === "complete"
                  ? handleMarkComplete(confirmAction.lesson)
                  : beginCancel(confirmAction.lesson)
              }
              className={confirmAction?.type === "complete" ? "bg-emerald-600" : "bg-red-600"}
            >
              {actionBusy ? "Сохранение…" : "Подтвердить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecurrenceApplyScopeDialog
        open={cancelScopeOpen}
        mode="status"
        value={cancelScope}
        onChange={setCancelScope}
        title="Отменить:"
        confirmLabel="Отменить"
        onCancel={() => {
          setCancelScopeOpen(false);
          setPendingCancelLesson(null);
        }}
        onConfirm={() => {
          if (!pendingCancelLesson) return;
          const lesson = pendingCancelLesson;
          setCancelScopeOpen(false);
          setPendingCancelLesson(null);
          void handleMarkCancelled(lesson, cancelScope);
        }}
      />
    </div>
  );
}