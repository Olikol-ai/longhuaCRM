import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { api } from '@/api';
import { Loader2 } from "lucide-react";
import { formatBelarusPhone, PHONE_PLACEHOLDER } from "@/utils/phone";

export default function StudentFormDialog({ open, onOpenChange, student, onSave }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    telegram_id: "",
    assigned_teacher: "",
    lesson_balance: 0,
    start_date: "",
    notes: "",
    status: "active",
  });

  useEffect(() => {
    if (open) {
      loadTeachers();
      if (student) {
        setFormData({ ...student });
      } else {
        setFormData({
          name: "",
          email: "",
          phone: "",
          telegram_id: "",
          assigned_teacher: "",
          lesson_balance: 0,
          start_date: new Date().toISOString().split("T")[0],
          notes: "",
          status: "active",
        });
      }
    }
  }, [open, student]);

  const loadTeachers = async () => {
    const t = await api.teachers.list();
    setTeachers(t.filter((x) => x.status === "active"));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = { ...formData, lesson_balance: Number(formData.lesson_balance) };
      if (student) {
        await api.students.update(student.id, data);
      } else {
        await api.students.create(data);
      }
      onSave?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{student ? "Редактировать ученика" : "Добавить ученика"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Имя *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Полное имя"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatBelarusPhone(e.target.value) })}
                placeholder={PHONE_PLACEHOLDER}
              />
            </div>
            <div className="space-y-2">
              <Label>Telegram ID</Label>
              <Input
                value={formData.telegram_id}
                onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                placeholder="@username or ID"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Преподаватель (только администратор)</Label>
              <Select
                value={formData.assigned_teacher || "none"}
                onValueChange={(v) => setFormData({ ...formData, assigned_teacher: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выбрать преподавателя" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Изменение преподавателя доступно только администратору</p>
            </div>
            <div className="space-y-2">
              <Label>Дата начала</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Баланс уроков</Label>
              <Input
                type="number"
                min={0}
                value={formData.lesson_balance}
                onChange={(e) => setFormData({ ...formData, lesson_balance: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="inactive">Неактивный</SelectItem>
                  <SelectItem value="paused">Пауза</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Заметки</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительные заметки..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.name} className="bg-indigo-600 hover:bg-indigo-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {student ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}