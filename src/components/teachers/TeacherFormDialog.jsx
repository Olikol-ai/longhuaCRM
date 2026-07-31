import React, { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
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
    status: "active",
    specializations: "",
  });

  useEffect(() => {
    if (open) {
      if (teacher) {
        setFormData({
          name: teacher.name || "",
          email: teacher.email || "",
          hourly_rate: teacher.hourly_rate ?? 0,
          status: teacher.status || "active",
          specializations: teacher.specializations || "",
        });
      } else {
        setFormData({
          name: "",
          email: "",
          hourly_rate: 0,
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
        await api.teachers.update(teacher.id, data);
      } else {
        await api.teachers.create(data);
      }
      onSave?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-md" fullscreenOnMobile>
      <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{teacher ? "Редактировать преподавателя" : "Добавить преподавателя"}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
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
            <Label>Эл. почта</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ivan@example.com"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ставка в час (BYN)</Label>
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
            <Label>Специализация</Label>
            <Input
              value={formData.specializations}
              onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              placeholder="Китайский, Английский..."
            />
          </div>
        </div>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.name} className="bg-primary hover:bg-primary/90">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {teacher ? "Сохранить" : "Создать"}
          </Button>
        </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}