import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MessageCircle,
  GraduationCap,
  BookOpen,
  CreditCard,
  Pencil,
  Plus,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { resolveAssignedTeacherLabel, resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import PaymentFormDialog from "@/components/payments/PaymentFormDialog";
import { Progress } from "@/components/ui/progress";

export default function StudentDetail() {
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("id");

  const [student, setStudent] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [payments, setPayments] = useState([]);
  const [enrollmentProgress, setEnrollmentProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (studentId) loadData();
  }, [studentId]);

  const loadData = async () => {
    const [allStudents, allLessons, allPayments, allTeachers, enrollments] = await Promise.all([
      api.students.list(),
      api.lessons.list("-date", 200),
      api.payments.list("-payment_date", 200),
      api.teachers.list(),
      api.courses.enrollments.filter({ student_id: studentId }),
    ]);

    const s = allStudents.find((x) => x.id === studentId);
    setStudent(s);

    setTeachers(allTeachers);

    if (s?.assigned_teacher) {
      setTeacher(allTeachers.find((t) => t.id === s.assigned_teacher));
    } else {
      setTeacher(null);
    }

    setLessons(allLessons.filter((l) =>
      l.primary_student_id === studentId ||
      l.student_id === studentId ||
      (l.student_ids || []).includes(studentId)
    ));
    setPayments(allPayments.filter((p) => p.student_id === studentId));

    const progressRows = await Promise.all(
      (enrollments ?? []).map(async (enrollment) => {
        try {
          const progress = await api.courses.enrollmentProgress(enrollment.id);
          return {
            enrollment,
            progress,
          };
        } catch {
          return { enrollment, progress: null };
        }
      }),
    );
    setEnrollmentProgress(progressRows);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 lg:p-8 text-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Ученик не найден</p>
        <Link to="/UserManagement">
          <Button variant="link" className="mt-2">Назад к ученикам</Button>
        </Link>
      </div>
    );
  }

  const info = [
    { icon: Mail, label: "Email", value: student.email },
    { icon: Phone, label: "Телефон", value: student.phone },
    { icon: MessageCircle, label: "Telegram", value: student.telegram_id },
    { icon: GraduationCap, label: "Преподаватель", value: resolveAssignedTeacherLabel(student.assigned_teacher, teachers) },
    { icon: BookOpen, label: "Баланс", value: `${student.lesson_balance || 0} уроков` },
  ].filter((x) => x.value);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/UserManagement" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Ученики
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
            <span className="text-xl font-bold text-indigo-600">{student.name[0].toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{student.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={
                student.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                student.status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }>
                {student.status}
              </Badge>
              {student.start_date && (
                <span className="text-xs text-slate-400">С {format(new Date(student.start_date), "MMM d, yyyy")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPaymentForm(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Добавить платёж
          </Button>
          <Button onClick={() => setShowEditForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Pencil className="h-4 w-4 mr-2" />
            Изменить
          </Button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {info.map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70">
            <div className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center">
              <item.icon className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {student.notes && (
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Заметки</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">{student.notes}</p>
          </CardContent>
        </Card>
      )}

      {enrollmentProgress.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Прогресс по курсам
          </h2>
          <div className="grid gap-4">
            {enrollmentProgress.map(({ enrollment, progress }) => {
              const total = progress?.total_lessons ?? enrollment.total_lessons ?? 0;
              const completed = progress?.completed_lessons ?? enrollment.completed_lessons ?? 0;
              const missed = progress?.missed_lessons ?? enrollment.missed_lessons ?? 0;
              const remaining = progress?.remaining_lessons ?? Math.max(0, total - completed - missed);
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <Card key={enrollment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        {enrollment.course_name || "Курс"}
                      </CardTitle>
                      <Badge variant="outline">{enrollment.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-400">Прогресс</span>
                        <span className="font-medium text-slate-900 dark:text-white">{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                        <p className="text-xs text-emerald-700">Завершено</p>
                        <p className="text-lg font-semibold text-emerald-800">{completed}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                        <p className="text-xs text-amber-700">Пропущено</p>
                        <p className="text-lg font-semibold text-amber-800">{missed}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
                        <p className="text-xs text-blue-700">Осталось</p>
                        <p className="text-lg font-semibold text-blue-800">{remaining}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Всего</p>
                        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Lesson History */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">История уроков</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/60">
                  <TableHead>Дата</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Преподаватель</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500 dark:text-slate-400">Уроков пока нет</TableCell>
                  </TableRow>
                ) : (
                  lessons.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.date}</TableCell>
                      <TableCell>{l.start_time}</TableCell>
                      <TableCell>{resolveLessonTeacherLabel(l, teachers)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          l.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                          l.status === "cancelled" ? "bg-red-50 text-red-700" :
                          l.status === "rescheduled" ? "bg-amber-50 text-amber-700" :
                          "bg-blue-50 text-blue-700"
                        }>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">История платежей</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/60">
                  <TableHead>Дата</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Уроков добавлено</TableHead>
                  <TableHead className="hidden sm:table-cell">Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500 dark:text-slate-400">Платежей пока нет</TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.payment_date}</TableCell>
                      <TableCell className="font-semibold text-emerald-600">${p.amount}</TableCell>
                      <TableCell>+{p.lessons_added}</TableCell>
                      <TableCell className="hidden sm:table-cell text-slate-500 dark:text-slate-400">{p.comment || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <StudentFormDialog
        open={showEditForm}
        onOpenChange={setShowEditForm}
        student={student}
        onSave={loadData}
      />
      <PaymentFormDialog
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        studentId={studentId}
        onSave={loadData}
      />
    </div>
  );
}