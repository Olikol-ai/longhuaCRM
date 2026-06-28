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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from '@/api';
import { Loader2 } from "lucide-react";

export default function TeacherFormDialog({ open, onOpenChange, teacher, onSave }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hourly_rate: 0,
    telegram_id: "",
    status: "active",
    specializations: "",
  });

  useEffect(() => {
    if (open) {
      if (teacher) {
        setFormData({ ...teacher });
      } else {
        setFormData({
          name: "",
          email: "",
          hourly_rate: 0,
          telegram_id: "",
          status: "active",
          specializations: "",
        });
      }
    }
  }, [open, teacher]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = { ...formData, hourly_rate: Number(formData.hourly_rate) };
      if (teacher) {
        await api.entities.Teacher.update(teacher.id, data);
      } else {
        await api.entities.Teacher.create(data);
      }
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
          <DialogTitle>{teacher ? "Редактировать преподавателя" : "Добавить преподавателя"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ставка в час ($)</Label>
              <Input
                type="number"
                min={0}
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
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
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Telegram ID</Label>
            <Input
              value={formData.telegram_id}
              onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
              placeholder="@username or ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Специализация</Label>
            <Input
              value={formData.specializations}
              onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              placeholder="Китайский, Английский..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.name} className="bg-indigo-600 hover:bg-indigo-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {teacher ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}