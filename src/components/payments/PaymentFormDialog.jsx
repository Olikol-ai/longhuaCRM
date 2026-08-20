import React, { useState, useEffect, useMemo } from "react";
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
import { api } from "@/api";
import { Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { userFacingError } from "@/lib/userFacingError";
import { hasUserAccount } from "@/lib/ownerStudents";
import {
  getTeacherContactLessonBalance,
} from "@/lib/lessonBalance";
import LessonBalanceDisplay from "@/components/students/LessonBalanceDisplay";

const DROPDOWN_Z = "z-[200]";

function studentMatchesQuery(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [row.name, row.first_name, row.last_name, row.phone, row.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function contactLinkedStudentId(contact) {
  return contact?.linked_student_id || contact?.linkedStudentId || "";
}

export default function PaymentFormDialog({ open, onOpenChange, studentId, onSave }) {
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [formData, setFormData] = useState({
    student_target_type: "crm",
    primary_student_id: "",
    teacher_student_contact_id: "",
    student_name: "",
    amount: "",
    lessons_added: "",
    payment_date: "",
    comment: "",
  });

  useEffect(() => {
    if (!open) return;
    setStudentQuery("");
    setFormData({
      student_target_type: "crm",
      primary_student_id: studentId || "",
      teacher_student_contact_id: "",
      student_name: "",
      amount: "",
      lessons_added: "",
      payment_date: new Date().toISOString().split("T")[0],
      comment: "",
    });
    void loadStudents();
  }, [open, studentId]);

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const [list, contactList] = await Promise.all([
        api.students.paymentOptions(),
        api.teacherStudentContacts
          .listMine({ ownerType: "teacher" })
          .catch(() => []),
      ]);
      const rows = Array.isArray(list) ? list : [];
      const contactRows = Array.isArray(contactList) ? contactList : [];
      setStudents(rows);
      setContacts(contactRows);

      if (studentId) {
        let found = rows.find((st) => st.id === studentId);
        if (!found) {
          try {
            found = await api.students.get(studentId);
          } catch {
            found = null;
          }
        }
        const linkedContact = contactRows.find(
          (c) => contactLinkedStudentId(c) === studentId,
        );
        if (linkedContact && (!found || !hasUserAccount(found))) {
          setFormData((prev) => ({
            ...prev,
            student_target_type: "contact",
            primary_student_id: "",
            teacher_student_contact_id: linkedContact.id,
            student_name: linkedContact.name || "",
          }));
        } else if (found) {
          setStudents((prev) =>
            prev.some((s) => s.id === found.id) ? prev : [found, ...prev],
          );
          setFormData((prev) => ({
            ...prev,
            student_target_type: "crm",
            primary_student_id: found.id,
            teacher_student_contact_id: "",
            student_name: found.name || "",
          }));
        }
      }
    } catch (err) {
      toast({
        title: "Не удалось загрузить учеников",
        description: userFacingError(err),
        variant: "destructive",
      });
      setStudents([]);
      setContacts([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const studentsById = useMemo(() => {
    const map = new Map();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const schoolStudents = useMemo(
    () =>
      students
        .filter((s) => s.status !== "inactive")
        .filter((s) => studentMatchesQuery(s, studentQuery)),
    [students, studentQuery],
  );

  const teacherPupils = useMemo(
    () =>
      contacts.filter((c) => {
        if (c.status === "inactive") return false;
        const ownerType = c.owner_type || c.ownerType;
        if (ownerType && ownerType !== "teacher") return false;
        const linkedId = contactLinkedStudentId(c);
        if (linkedId) {
          const linked = studentsById.get(linkedId);
          if (linked && hasUserAccount(linked)) return false;
        }
        return studentMatchesQuery(c, studentQuery);
      }),
    [contacts, studentsById, studentQuery],
  );

  const canSubmit =
    formData.amount &&
    formData.lessons_added &&
    Number(formData.lessons_added) >= 1 &&
    (formData.student_target_type === "contact"
      ? !!formData.teacher_student_contact_id
      : !!formData.primary_student_id);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      let student_id = formData.primary_student_id;
      let student_name = formData.student_name;

      if (formData.student_target_type === "contact") {
        const contact =
          teacherPupils.find((c) => c.id === formData.teacher_student_contact_id) ||
          contacts.find((c) => c.id === formData.teacher_student_contact_id);
        const linkedId = contactLinkedStudentId(contact);
        if (!linkedId) {
          throw new Error(
            "У этого ученика преподавателя ещё нет школьной карточки. Обновите страницу и попробуйте снова.",
          );
        }
        student_id = linkedId;
        student_name = contact?.name || "";
      } else {
        const student = studentsById.get(formData.primary_student_id);
        student_name = student?.name || formData.student_name || "";
      }

      await api.payments.create({
        student_id,
        student_name,
        amount: Number(formData.amount),
        lessons_added: Number(formData.lessons_added),
        payment_date: formData.payment_date,
        comment: formData.comment,
      });
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Не удалось сохранить оплату",
        description: userFacingError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const lockedStudent = Boolean(studentId);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      fullscreenOnMobile
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Записать оплату</ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Тип ученика *</Label>
          <Select
            value={formData.student_target_type}
            onValueChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                student_target_type: value,
                primary_student_id: "",
                teacher_student_contact_id: "",
                student_name: "",
              }));
              setStudentQuery("");
            }}
            disabled={loadingStudents || lockedStudent}
          >
            <SelectTrigger data-testid="payment-form-student-target-type">
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
            {formData.student_target_type === "contact"
              ? "Ученик преподавателя *"
              : "Ученик школы *"}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Поиск по имени, телефону, email…"
              className="pl-9"
              data-testid="payment-form-student-search"
              disabled={lockedStudent}
            />
          </div>
          {formData.student_target_type === "contact" ? (
            <Select
              value={formData.teacher_student_contact_id || undefined}
              onValueChange={(id) => {
                const contact = contacts.find((c) => c.id === id);
                setFormData({
                  ...formData,
                  teacher_student_contact_id: id,
                  primary_student_id: "",
                  student_name: contact?.name || "",
                });
              }}
              disabled={loadingStudents || lockedStudent}
            >
              <SelectTrigger data-testid="payment-form-student-select">
                <SelectValue
                  placeholder={loadingStudents ? "Загрузка…" : "Выберите ученика"}
                />
              </SelectTrigger>
              <SelectContent className={DROPDOWN_Z}>
                {teacherPupils.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Нет учеников преподавателя
                  </SelectItem>
                ) : (
                  teacherPupils.map((c) => {
                    const { balance } = getTeacherContactLessonBalance(c, studentsById);
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` · ${c.phone}` : ""}{" "}
                        (баланс:{" "}
                        <LessonBalanceDisplay balance={balance} emptyLabel="—" />)
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={formData.primary_student_id || undefined}
              onValueChange={(id) => {
                const student = students.find((s) => s.id === id);
                setFormData({
                  ...formData,
                  primary_student_id: id,
                  teacher_student_contact_id: "",
                  student_name: student?.name || "",
                });
              }}
              disabled={loadingStudents || lockedStudent}
            >
              <SelectTrigger data-testid="payment-form-student-select">
                <SelectValue
                  placeholder={loadingStudents ? "Загрузка…" : "Выберите ученика"}
                />
              </SelectTrigger>
              <SelectContent className={DROPDOWN_Z}>
                {schoolStudents.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Нет учеников школы
                  </SelectItem>
                ) : (
                  schoolStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.phone ? ` · ${s.phone}` : ""}{" "}
                      (баланс: <LessonBalanceDisplay row={s} className="inline" />)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Сумма (BYN) *</Label>
            <Input
              type="number"
              min={0}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Уроков добавлено *</Label>
            <Input
              type="number"
              min={1}
              value={formData.lessons_added}
              onChange={(e) =>
                setFormData({ ...formData, lessons_added: e.target.value })
              }
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Дата оплаты</Label>
          <Input
            type="date"
            value={formData.payment_date}
            onChange={(e) =>
              setFormData({ ...formData, payment_date: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Комментарий</Label>
          <Textarea
            value={formData.comment}
            onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
            placeholder="Например: пакет на 8 занятий"
            rows={2}
          />
        </div>
      </div>
      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="bg-primary hover:bg-primary/90"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить оплату
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
