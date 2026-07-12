import { useState, useEffect } from "react";
import { api } from '@/api';
import { Save, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIME_OPTIONS } from "@/lib/time-slots";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function TeacherAvailabilityTab({ teacher }) {
  const [slots, setSlots] = useState(Array.from({ length: 7 }, () => []));
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    loadAvailability();
  }, [teacher]);

  const loadAvailability = async () => {
    const availability = await api.schedule.getTeacherAvailability(teacher.id);
    const byDay = Array.from({ length: 7 }, () => []);
    (availability?.slots || []).forEach((slot) => {
      byDay[slot.day] = [...(byDay[slot.day] || []), { from: slot.from, to: slot.to }];
    });
    setSlots(byDay);
    setRecordId(availability?.hasSchedule ? teacher.id : null);
    setLoading(false);
  };

  const addSlot = (dayIndex) => {
    setSlots(prev => {
      const next = prev.map(d => [...d]);
      next[dayIndex] = [...next[dayIndex], { from: "18:00", to: "21:00" }];
      return next;
    });
  };

  const removeSlot = (dayIndex, slotIndex) => {
    setSlots(prev => {
      const next = prev.map(d => [...d]);
      next[dayIndex] = next[dayIndex].filter((_, i) => i !== slotIndex);
      return next;
    });
  };

  const updateSlot = (dayIndex, slotIndex, field, value) => {
    setSlots(prev => {
      const next = prev.map(d => [...d]);
      next[dayIndex] = next[dayIndex].map((s, i) => i === slotIndex ? { ...s, [field]: value } : s);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const flatSlots = [];
    slots.forEach((daySlots, dayIndex) => {
      daySlots.forEach(slot => {
        flatSlots.push({ day: dayIndex, from: slot.from, to: slot.to });
      });
    });
    await api.schedule.replaceTeacherAvailability(teacher.id, flatSlots);
    setRecordId(teacher.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const totalSlots = slots.reduce((sum, d) => sum + d.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Мой свободный график</h2>
          <p className="text-sm text-slate-400 mt-0.5">Укажите, в какое время вы готовы принимать учеников</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`gap-2 ${saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Сохранено!" : "Сохранить"}
        </Button>
      </div>

      {/* Summary bar */}
      {totalSlots > 0 && (
        <div className="flex flex-wrap gap-2">
          {slots.map((daySlots, i) =>
            daySlots.length > 0 ? (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                {DAYS_SHORT[i]}
                {daySlots.map((s, j) => (
                  <span key={j} className="text-indigo-500">{s.from}–{s.to}{j < daySlots.length - 1 ? "," : ""}</span>
                ))}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Week grid */}
      <div className="space-y-3">
        {DAYS.map((dayName, dayIndex) => {
          const daySlots = slots[dayIndex];
          const hasSlots = daySlots.length > 0;
          return (
            <div
              key={dayIndex}
              className={`bg-white rounded-2xl border transition-colors ${hasSlots ? "border-indigo-200" : "border-slate-200"}`}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Day label */}
                <div className="w-32 flex-shrink-0">
                  <p className={`text-sm font-semibold ${hasSlots ? "text-slate-900" : "text-slate-400"}`}>{dayName}</p>
                  <p className="text-xs text-slate-300">{DAYS_SHORT[dayIndex]}</p>
                </div>

                {/* Slots */}
                <div className="flex-1 flex flex-wrap items-center gap-3">
                  {daySlots.length === 0 ? (
                    <span className="text-sm text-slate-300 italic">Не указано</span>
                  ) : (
                    daySlots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
                        <span className="text-xs text-slate-500 font-medium">с</span>
                        <select
                          value={slot.from}
                          onChange={e => updateSlot(dayIndex, slotIndex, "from", e.target.value)}
                          className="text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-xs text-slate-500 font-medium">до</span>
                        <select
                          value={slot.to}
                          onChange={e => updateSlot(dayIndex, slotIndex, "to", e.target.value)}
                          className="text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                          onClick={() => removeSlot(dayIndex, slotIndex)}
                          className="text-slate-300 hover:text-red-400 transition-colors ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => addSlot(dayIndex)}
                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}