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

export default function PaymentFormDialog({ open, onOpenChange, studentId, onSave }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_id: "",
    student_name: "",
    amount: "",
    lessons_added: "",
    payment_date: "",
    comment: "",
  });

  useEffect(() => {
    if (open) {
      loadStudents();
      setFormData({
        student_id: studentId || "",
        student_name: "",
        amount: "",
        lessons_added: "",
        payment_date: new Date().toISOString().split("T")[0],
        comment: "",
      });
    }
  }, [open, studentId]);

  const loadStudents = async () => {
    const s = await api.students.list();
    setStudents(s);
    if (studentId) {
      const found = s.find((st) => st.id === studentId);
      if (found) {
        setFormData((prev) => ({ ...prev, student_name: found.name }));
      }
    }
  };

  const handleStudentChange = (id) => {
    const student = students.find((s) => s.id === id);
    setFormData({
      ...formData,
      student_id: id,
      student_name: student?.name || "",
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payment = {
        student_id: formData.student_id,
        student_name: formData.student_name,
        amount: Number(formData.amount),
        lessons_added: Number(formData.lessons_added),
        payment_date: formData.payment_date,
        comment: formData.comment,
      };
      await api.payments.create(payment);
      onSave?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Записать оплату</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Ученик *</Label>
            <Select value={formData.student_id} onValueChange={handleStudentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите ученика" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                min={0}
                value={formData.lessons_added}
                onChange={(e) => setFormData({ ...formData, lessons_added: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Дата оплаты</Label>
            <Input
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.student_id || !formData.amount || !formData.lessons_added}
            className="bg-primary hover:bg-primary/90"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
