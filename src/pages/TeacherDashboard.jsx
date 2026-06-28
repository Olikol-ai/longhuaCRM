import React, { useState, useEffect } from "react";
import MaterialPickerDialog from "@/components/materials/MaterialPickerDialog";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Calendar, CheckCircle2, XCircle, Clock, Loader2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/dashboard/StatCard";
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

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const [allTeachers, allLessons, allStudents] = await Promise.all([
      base44.entities.Teacher.list(),
      base44.entities.Lesson.list("-date", 200),
      base44.entities.Student.list(),
    ]);
    const t = allTeachers.find((x) => x.user_id === me.id || x.email === me.email);
    setTeacher(t);
    if (t) {
      setLessons(allLessons.filter((l) => l.teacher_id === t.id));
    }
    setStudents(allStudents);
    setLoading(false);
  };

  const handleMarkComplete = async (lesson, materialIds = []) => {
    await base44.entities.Lesson.update(lesson.id, { status: "completed", material_ids: materialIds });
    const ids = lesson.student_ids?.length ? lesson.student_ids : lesson.student_id ? [lesson.student_id] : [];
    for (const sid of ids) {
      const arr = await base44.entities.Student.filter({ id: sid });
      const student = arr[0];
      if (student?.telegram_id) {
        const newBalance = student.lesson_balance ?? 0;
        const msg = `✅ Урок завершён!\n\n📅 ${lesson.date} в ${lesson.start_time}\n💡 Осталось уроков: ${newBalance}`;
        base44.functions.invoke("sendTelegramMessage", { chat_id: student.telegram_id, text: msg }).catch(() => {});
        if (newBalance === 0) {
          const balMsg = `⚠️ Баланс уроков исчерпан!\n\nТекущий урок (${lesson.date} в ${lesson.start_time}) не оплачен — на вашем счёте 0 уроков.\n\nПожалуйста, пополните баланс, чтобы продолжить занятия. Свяжитесь с администратором.`;
          base44.functions.invoke("sendTelegramMessage", { chat_id: student.telegram_id, text: balMsg }).catch(() => {});
        }
      }
    }
    setConfirmAction(null);
    loadData();
  };

  const handleMarkCancelled = async (lesson) => {
    await base44.entities.Lesson.update(lesson.id, { status: "cancelled" });
    setConfirmAction(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6 lg:p-8 text-center py-20">
        <p className="text-slate-500">Профиль преподавателя не найден для вашего аккаунта.</p>
        <p className="text-xs text-slate-400 mt-2">Обратитесь к администратору.</p>
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto dark:bg-slate-950 min-h-screen">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Добро пожаловать, {teacher.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <button onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Сменить тему">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Уроков сегодня" value={todayLessons.length} icon={Calendar} color="indigo" />
        <StatCard title="Предстоящие" value={upcomingLessons.length} icon={Clock} color="sky" />
        <StatCard title="Завершено" value={completedCount} icon={CheckCircle2} color="emerald" />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Предстоящие уроки</h2>
      {upcomingLessons.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Предстоящих уроков нет</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingLessons.slice(0, 20).map((lesson) => (
            <Card key={lesson.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                           <div className="text-center min-w-[60px]">
                             <p className="text-xs text-slate-400 dark:text-slate-500">{format(new Date(lesson.date), "MMM d")}</p>
                             <p className="text-lg font-bold text-slate-900 dark:text-white">{lesson.start_time}</p>
                             <p className="text-[11px] text-slate-400 dark:text-slate-500">{lesson.duration || 60} min</p>
                           </div>
                           <div>
                             <p className="font-medium text-slate-900 dark:text-white">{lesson.student_name}</p>
                    {lesson.meeting_link && (
                      <a
                        href={lesson.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
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
                    className="text-red-600 border-red-200 hover:bg-red-50"
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
          lessonInfo={`${confirmAction.lesson.student_name} · ${confirmAction.lesson.date} ${confirmAction.lesson.start_time}`}
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
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmAction?.type === "complete"
                  ? handleMarkComplete(confirmAction.lesson)
                  : handleMarkCancelled(confirmAction.lesson)
              }
              className={confirmAction?.type === "complete" ? "bg-emerald-600" : "bg-red-600"}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}