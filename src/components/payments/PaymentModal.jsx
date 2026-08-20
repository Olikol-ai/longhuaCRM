import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasUserAccount } from "@/lib/ownerStudents";
import {
  formatLessonBalance,
  getLessonBalance,
  getTeacherContactLessonBalance,
} from "@/lib/lessonBalance";
import LessonBalanceDisplay from "@/components/students/LessonBalanceDisplay";
import { formatBYN } from "@/lib/formatters";

const DROPDOWN_Z = "z-[200]";

function studentMatchesQuery(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.name,
    row.first_name,
    row.last_name,
    row.phone,
    row.email,
    row.telegram_username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function contactLinkedStudentId(contact) {
  return contact?.linked_student_id || contact?.linkedStudentId || "";
}

function resolveInitialTarget(initialData, students, contacts) {
  const studentId = initialData?.student_id || "";
  if (!studentId) {
    return {
      student_target_type: "crm",
      primary_student_id: "",
      teacher_student_contact_id: "",
    };
  }
  const contact = (Array.isArray(contacts) ? contacts : []).find(
    (c) => contactLinkedStudentId(c) === studentId,
  );
  if (contact) {
    return {
      student_target_type: "contact",
      primary_student_id: "",
      teacher_student_contact_id: contact.id,
    };
  }
  return {
    student_target_type: "crm",
    primary_student_id: studentId,
    teacher_student_contact_id: "",
  };
}

function formatBalanceLabel(balance) {
  if (balance === null || balance === undefined) return "баланс: —";
  return `баланс: ${formatLessonBalance(balance, { signed: true })}`;
}

/**
 * Create / edit payment dialog for the Payments page.
 * Parent owns API create/update; this dialog only prepares the payload.
 */
export default function PaymentModal({
  open = true,
  students,
  contacts = [],
  onSave,
  onClose,
  initialData,
  saving = false,
}) {
  const initialTarget = resolveInitialTarget(initialData, students, contacts);
  const [form, setForm] = useState({
    student_target_type: initialTarget.student_target_type,
    primary_student_id: initialTarget.primary_student_id,
    teacher_student_contact_id: initialTarget.teacher_student_contact_id,
    amount: initialData?.amount ?? "",
    lessons_added: initialData?.lessons_added ?? "",
    payment_date: initialData?.payment_date || format(new Date(), "yyyy-MM-dd"),
    comment: initialData?.comment || "",
  });
  const [studentQuery, setStudentQuery] = useState("");
  const [saveError, setSaveError] = useState("");

  const isEdit = Boolean(initialData);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const studentsById = useMemo(() => {
    const map = new Map();
    for (const s of Array.isArray(students) ? students : []) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  const schoolStudents = useMemo(() => {
    return (Array.isArray(students) ? students : [])
      .filter((s) => s.status !== "inactive")
      .filter((s) => studentMatchesQuery(s, studentQuery));
  }, [students, studentQuery]);

  const teacherPupils = useMemo(() => {
    return (Array.isArray(contacts) ? contacts : []).filter((c) => {
      if (c.status === "inactive") return false;
      const ownerType = c.owner_type || c.ownerType;
      if (ownerType && ownerType !== "teacher") return false;
      const linkedId = contactLinkedStudentId(c);
      if (linkedId) {
        const linked = studentsById.get(linkedId);
        if (linked && hasUserAccount(linked)) return false;
      }
      return studentMatchesQuery(c, studentQuery);
    });
  }, [contacts, studentsById, studentQuery]);

  const selectedBalance = useMemo(() => {
    if (form.student_target_type === "contact") {
      const contact =
        teacherPupils.find((c) => c.id === form.teacher_student_contact_id) ||
        (Array.isArray(contacts) ? contacts : []).find(
          (c) => c.id === form.teacher_student_contact_id,
        );
      return getTeacherContactLessonBalance(contact, studentsById).balance;
    }
    const student = studentsById.get(form.primary_student_id);
    return student ? getLessonBalance(student) : null;
  }, [
    form.student_target_type,
    form.teacher_student_contact_id,
    form.primary_student_id,
    teacherPupils,
    contacts,
    studentsById,
  ]);

  const canSave =
    form.amount &&
    form.lessons_added &&
    Number(form.lessons_added) >= 1 &&
    (form.student_target_type === "contact"
      ? Boolean(form.teacher_student_contact_id)
      : Boolean(form.primary_student_id));

  const handleSave = () => {
    setSaveError("");
    if (!canSave || saving) return;

    if (form.student_target_type === "contact") {
      const contact =
        teacherPupils.find((c) => c.id === form.teacher_student_contact_id) ||
        (Array.isArray(contacts) ? contacts : []).find(
          (c) => c.id === form.teacher_student_contact_id,
        );
      const linkedId = contactLinkedStudentId(contact);
      if (!linkedId) {
        setSaveError(
          "У этого ученика преподавателя ещё нет школьной карточки. Обновите страницу и попробуйте снова.",
        );
        return;
      }
      if (!studentsById.has(linkedId)) {
        setSaveError(
          "Школьная карточка ученика не найдена в списке для платежей. Обновите страницу.",
        );
        return;
      }
      onSave({
        student_id: linkedId,
        student_name: contact?.name || initialData?.student_name || "",
        amount: +form.amount,
        lessons_added: +form.lessons_added,
        payment_date: form.payment_date,
        comment: form.comment,
      });
      return;
    }

    const student = studentsById.get(form.primary_student_id);
    onSave({
      student_id: form.primary_student_id,
      student_name: student?.name || initialData?.student_name || "",
      amount: +form.amount,
      lessons_added: +form.lessons_added,
      payment_date: form.payment_date,
      comment: form.comment,
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose?.();
      }}
      className="sm:max-w-md"
      fullscreenOnMobile
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          {isEdit ? "Редактировать платёж" : "Добавить платёж"}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <div className="space-y-4 py-2 min-w-0">
        <div className="space-y-2">
          <Label>Тип ученика *</Label>
          <Select
            value={form.student_target_type}
            onValueChange={(value) => {
              setForm((f) => ({
                ...f,
                student_target_type: value,
                primary_student_id: "",
                teacher_student_contact_id: "",
              }));
              setStudentQuery("");
              setSaveError("");
            }}
            disabled={isEdit || saving}
          >
            <SelectTrigger className="w-full h-11 md:h-10" data-testid="payment-student-target-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={DROPDOWN_Z}>
              <SelectItem value="crm">Ученик школы</SelectItem>
              <SelectItem value="contact">Ученик преподавателя</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            {form.student_target_type === "contact"
              ? "Ученик преподавателя *"
              : "Ученик школы *"}
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Поиск по имени, телефону, email…"
              className="h-11 pl-9 md:h-10"
              data-testid="payment-student-search"
              disabled={isEdit || saving}
            />
          </div>
          {form.student_target_type === "contact" ? (
            <Select
              value={form.teacher_student_contact_id || undefined}
              onValueChange={(value) => set("teacher_student_contact_id", value)}
              disabled={isEdit || saving}
            >
              <SelectTrigger className="w-full h-11 md:h-10" data-testid="payment-student-select">
                <SelectValue placeholder="Выбрать из списка" />
              </SelectTrigger>
              <SelectContent className={DROPDOWN_Z}>
                {teacherPupils.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Нет учеников преподавателя по запросу
                  </SelectItem>
                ) : (
                  teacherPupils.map((c) => {
                    const { balance } = getTeacherContactLessonBalance(c, studentsById);
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || "Без имени"}
                        {c.phone ? ` · ${c.phone}` : ""}{" "}
                        ({formatBalanceLabel(balance)})
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={form.primary_student_id || undefined}
              onValueChange={(value) => set("primary_student_id", value)}
              disabled={isEdit || saving}
            >
              <SelectTrigger className="w-full h-11 md:h-10" data-testid="payment-student-select">
                <SelectValue placeholder="Выбрать ученика" />
              </SelectTrigger>
              <SelectContent className={DROPDOWN_Z}>
                {schoolStudents.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Нет учеников школы по запросу
                  </SelectItem>
                ) : (
                  schoolStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || "Без имени"}
                      {s.phone ? ` · ${s.phone}` : ""}
                      {hasUserAccount(s) ? "" : " · без кабинета"}{" "}
                      ({formatBalanceLabel(getLessonBalance(s))})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            {form.student_target_type === "contact"
              ? "Ученики преподавателя без личного кабинета CRM. Платёж и баланс — на связанной школьной карточке (Student)."
              : "Школьные карточки учеников. Баланс всегда из students.lesson_balance."}
          </p>
        </div>

        {selectedBalance !== null ? (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
            Текущий остаток занятий:{" "}
            <LessonBalanceDisplay
              balance={selectedBalance}
              data-testid="payment-selected-balance"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="payment-amount">Сумма (BYN) *</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              className="h-11 md:h-10"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </div>
          <div className="space-y-2 min-w-0">
            <Label htmlFor="payment-lessons">Куплено уроков *</Label>
            <Input
              id="payment-lessons"
              type="number"
              min="1"
              className="h-11 md:h-10"
              value={form.lessons_added}
              onChange={(e) => set("lessons_added", e.target.value)}
              placeholder="0"
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-date">Дата платежа</Label>
          <Input
            id="payment-date"
            type="date"
            className="h-11 md:h-10"
            value={form.payment_date}
            onChange={(e) => set("payment_date", e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-comment">Комментарий</Label>
          <Textarea
            id="payment-comment"
            value={form.comment}
            onChange={(e) => set("comment", e.target.value)}
            rows={2}
            placeholder="Необязательная заметка…"
            className="resize-none"
            disabled={saving}
          />
        </div>

        {saveError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}

        {canSave ? (
          <div className="rounded-xl bg-brand-soft px-3 py-2.5 text-sm text-brand dark:bg-brand-soft/40">
            Сумма: <strong className="whitespace-nowrap">{formatBYN(form.amount)}</strong> · Баланс увеличится на{" "}
            <strong>{form.lessons_added}</strong> уроков
            {selectedBalance !== null ? (
              <>
                {" "}
                → станет{" "}
                <strong>{selectedBalance + Number(form.lessons_added || 0)}</strong>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? "Сохранить изменения" : "Сохранить платёж"}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
