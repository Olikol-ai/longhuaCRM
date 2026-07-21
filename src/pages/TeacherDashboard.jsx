import React, { useState, useEffect, useMemo } from "react";
import MaterialPickerDialog from "@/components/materials/MaterialPickerDialog";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getGreetingName } from '@/lib/display-name';
import { resolveLessonStudentLabel } from '@/lib/studentLabels';
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, CheckCircle2, XCircle, Clock, Loader2, Sun, Moon, DollarSign, Link2, Copy } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/dashboard/StatCard";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/formatters";
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

function isActiveInvite(row) {
  if (!row || row.revoked_at) return false;
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  return expires > Date.now();
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { theme, toggleTheme } = useTheme();

  const activeInvites = useMemo(
    () => invites.filter(isActiveInvite),
    [invites],
  );

  const loadData = async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const [allTeachers, allLessons, allStudents, myPayments, myInvites] = await Promise.all([
        api.teachers.list(),
        api.lessons.list("-date", 200),
        api.students.list(),
        api.teacherPayments.my().catch(() => []),
        api.teacherInvites.list().catch(() => []),
      ]);
      const t = allTeachers.find((x) => x.user_id === user.id || x.email === user.email);
      setTeacher(t);
      if (t) {
        setLessons(allLessons.filter((l) => l.teacher_id === t.id));
        setStudents(allStudents.filter((s) => s.assigned_teacher === t.id));
      } else {
        setLessons([]);
        setStudents([]);
      }
      setPayments(Array.isArray(myPayments) ? myPayments : []);
      setInvites(Array.isArray(myInvites) ? myInvites : []);
    } catch (err) {
      setLoadError(err?.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    try {
      const created = await api.teacherInvites.create();
      const url = `${window.location.origin}${created.path || `/register?ref=${created.token}`}`;
      setLatestInviteUrl(url);
      toast({ title: "Ссылка приглашения создана" });
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось создать ссылку",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!latestInviteUrl) return;
    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Скопируйте ссылку вручную", description: latestInviteUrl });
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

  const handleMarkCancelled = async (lesson) => {
    setActionBusy(true);
    try {
      await api.lessons.update(lesson.id, { status: "cancelled" });
      setConfirmAction(null);
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
        <p className="text-slate-600 dark:text-slate-300">{loadError}</p>
        <Button variant="outline" onClick={() => { setLoading(true); loadData(); }}>
          Повторить
        </Button>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Профиль преподавателя не найден для вашего аккаунта.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Обратитесь к администратору.</p>
      </div>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLessons = lessons.filter((l) => l.date === todayStr && l.status !== "cancelled");
  const upcomingLessons = lessons
    .filter((l) => l.date >= todayStr && l.status === "planned")
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
  const completedCount = lessons.filter((l) => l.status === "completed").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto dark:bg-slate-950 min-h-screen">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Добро пожаловать, {getGreetingName(teacher) || getGreetingName(user) || "Преподаватель"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{format(new Date(), "EEEE, d MMMM yyyy", { locale: ru })}</p>
        </div>
        <button onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Сменить тему">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Уроков сегодня" value={todayLessons.length} icon={Calendar} color="brand" />
        <StatCard title="Предстоящие" value={upcomingLessons.length} icon={Clock} color="muted" />
        <StatCard title="Завершено" value={completedCount} icon={CheckCircle2} color="emerald" />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Приглашение учеников</h2>
      <Card className="p-4 mb-8 space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Создайте ссылку. После регистрации и подтверждения email ученик автоматически закрепится за вами.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCreateInvite}
            disabled={inviteBusy}
            className="bg-primary hover:bg-primary/90 gap-2"
            data-testid="teacher-invite-create"
          >
            {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Создать ссылку
          </Button>
          {latestInviteUrl && (
            <Button type="button" variant="outline" onClick={handleCopyInvite} className="gap-2">
              <Copy className="h-4 w-4" />
              Копировать
            </Button>
          )}
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
                    до {format(new Date(row.expires_at), "dd.MM.yyyy")} · использований: {row.use_count ?? 0}
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

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Мои выплаты</h2>
      {payments.length === 0 ? (
        <Card className="p-6 text-center border-dashed mb-8">
          <DollarSign className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Начислений пока нет</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {payments.slice(0, 10).map((row) => (
            <Card key={row.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> {formatCurrency(row.amount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.status}</p>
              </div>
              <Badge variant={row.status === "paid" ? "default" : "secondary"}>
                {row.status === "paid" ? "Оплачено" : "Ожидает"}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Предстоящие уроки</h2>
      {upcomingLessons.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Предстоящих уроков нет</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingLessons.slice(0, 20).map((lesson) => (
            <Card key={lesson.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                           <div className="text-center min-w-[60px]">
                             <p className="text-xs text-slate-400 dark:text-slate-500">{format(new Date(lesson.date), "d MMM", { locale: ru })}</p>
                             <p className="text-lg font-bold text-slate-900 dark:text-white">{lesson.start_time}</p>
                             <p className="text-[11px] text-slate-400 dark:text-slate-500">{lesson.duration || 60} min</p>
                           </div>
                           <div>
                             <p className="font-medium text-slate-900 dark:text-white">{resolveLessonStudentLabel(lesson, students)}</p>
                    {lesson.meeting_link && (
                      <a
                        href={lesson.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand dark:text-brand hover:underline"
                      >
                        Войти на встречу →
                      </a>
                    )}
                    {lesson.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{lesson.notes}</p>}
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
                  : handleMarkCancelled(confirmAction.lesson)
              }
              className={confirmAction?.type === "complete" ? "bg-emerald-600" : "bg-red-600"}
            >
              {actionBusy ? "Сохранение…" : "Подтвердить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}