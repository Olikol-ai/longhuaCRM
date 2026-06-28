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
import { Switch } from "@/components/ui/switch";
import { api } from '@/api';
import { Loader2 } from "lucide-react";

export default function LessonFormDialog({ open, onOpenChange, lesson, onSave }) {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    teacher_id: "",
    teacher_name: "",
    student_id: "",
    student_name: "",
    date: "",
    start_time: "",
    duration: 60,
    meeting_link: "",
    status: "planned",
    notes: "",
    is_recurring: false,
    recurring_weeks: 4,
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (lesson) {
        setFormData({
          ...lesson,
          is_recurring: false,
          recurring_weeks: 4,
        });
      } else {
        setFormData({
          teacher_id: "",
          teacher_name: "",
          student_id: "",
          student_name: "",
          date: new Date().toISOString().split("T")[0],
          start_time: "10:00",
          duration: 60,
          meeting_link: "",
          status: "planned",
          notes: "",
          is_recurring: false,
          recurring_weeks: 4,
        });
      }
    }
  }, [open, lesson]);

  const loadData = async () => {
    const [t, s] = await Promise.all([
      api.entities.Teacher.list(),
      api.entities.Student.list(),
    ]);
    setTeachers(t.filter((x) => x.status === "active"));
    setStudents(s.filter((x) => x.status === "active"));
  };

  const handleTeacherChange = (id) => {
    const teacher = teachers.find((t) => t.id === id);
    setFormData({
      ...formData,
      teacher_id: id,
      teacher_name: teacher?.name || "",
      teacher_first_name: teacher?.first_name || "",
      teacher_last_name: teacher?.last_name || "",
    });
  };

  const handleStudentChange = (id) => {
    const student = students.find((s) => s.id === id);
    setFormData({
      ...formData,
      student_id: id,
      student_name: student?.name || "",
      student_first_name: student?.first_name || "",
      student_last_name: student?.last_name || "",
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (formData.is_recurring && !lesson) {
        const groupId = `rec_${Date.now()}`;
        const lessons = [];
        for (let i = 0; i < formData.recurring_weeks; i++) {
          const d = new Date(formData.date);
          d.setDate(d.getDate() + i * 7);
          lessons.push({
            teacher_id: formData.teacher_id,
            teacher_name: formData.teacher_name,
            teacher_first_name: formData.teacher_first_name || "",
            teacher_last_name: formData.teacher_last_name || "",
            student_id: formData.student_id,
            student_name: formData.student_name,
            student_first_name: formData.student_first_name || "",
            student_last_name: formData.student_last_name || "",
            date: d.toISOString().split("T")[0],
            start_time: formData.start_time,
            duration: formData.duration,
            meeting_link: formData.meeting_link,
            status: "planned",
            notes: formData.notes,
            is_recurring: true,
            recurring_group_id: groupId,
          });
        }
        await api.entities.Lesson.bulkCreate(lessons);
      } else {
        const data = {
          teacher_id: formData.teacher_id,
          teacher_name: formData.teacher_name,
          teacher_first_name: formData.teacher_first_name || "",
          teacher_last_name: formData.teacher_last_name || "",
          student_id: formData.student_id,
          student_name: formData.student_name,
          student_first_name: formData.student_first_name || "",
          student_last_name: formData.student_last_name || "",
          date: formData.date,
          start_time: formData.start_time,
          duration: formData.duration,
          meeting_link: formData.meeting_link,
          status: formData.status,
          notes: formData.notes,
        };
        if (lesson) {
          await api.entities.Lesson.update(lesson.id, data);
        } else {
          await api.entities.Lesson.create(data);
        }
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
          <DialogTitle>{lesson ? "Edit Lesson" : "Schedule Lesson"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={formData.teacher_id} onValueChange={handleTeacherChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={formData.student_id} onValueChange={handleStudentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Select
                value={String(formData.duration)}
                onValueChange={(v) => setFormData({ ...formData, duration: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Link</Label>
            <Input
              placeholder="https://zoom.us/..."
              value={formData.meeting_link}
              onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
            />
          </div>

          {lesson && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Lesson notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {!lesson && (
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <Label>Recurring Weekly</Label>
                <Switch
                  checked={formData.is_recurring}
                  onCheckedChange={(v) => setFormData({ ...formData, is_recurring: v })}
                />
              </div>
              {formData.is_recurring && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Number of weeks</Label>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={formData.recurring_weeks}
                    onChange={(e) => setFormData({ ...formData, recurring_weeks: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {lesson ? "Update" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}