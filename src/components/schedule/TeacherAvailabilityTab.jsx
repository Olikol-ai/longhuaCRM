import { useState, useEffect } from "react";
import { api } from '@/api';
import { Save, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIME_OPTIONS } from "@/lib/time-slots";
import { userFacingError } from "@/lib/userFacingError";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function slotsToByDay(scheduleSlots) {
  const byDay = Array.from({ length: 7 }, () => []);
  (scheduleSlots || []).forEach((slot) => {
    const day = Number(slot.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return;
    byDay[day] = [...byDay[day], { from: slot.from, to: slot.to }];
  });
  return byDay;
}

export default function TeacherAvailabilityTab({ teacher }) {
  const [slots, setSlots] = useState(Array.from({ length: 7 }, () => []));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teacher?.id) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      setLoading(true);
      setError('');
      try {
        const availability = await api.schedule.getTeacherAvailability(teacher.id);
        if (cancelled) return;
        setSlots(slotsToByDay(availability?.slots));
      } catch (err) {
        if (cancelled) return;
        setError(
          userFacingError(err, 'Не удалось загрузить свободный график.'),
        );
        setSlots(Array.from({ length: 7 }, () => []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [teacher?.id]);

  const addSlot = (dayIndex) => {
    setSaved(false);
    setError('');
    setSlots((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = [...next[dayIndex], { from: "18:00", to: "21:00" }];
      return next;
    });
  };

  const removeSlot = (dayIndex, slotIndex) => {
    setSaved(false);
    setError('');
    setSlots((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = next[dayIndex].filter((_, i) => i !== slotIndex);
      return next;
    });
  };

  const updateSlot = (dayIndex, slotIndex, field, value) => {
    setSaved(false);
    setError('');
    setSlots((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = next[dayIndex].map((s, i) =>
        i === slotIndex ? { ...s, [field]: value } : s,
      );
      return next;
    });
  };

  const handleSave = async () => {
    if (!teacher?.id || saving) return;

    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const flatSlots = [];
      slots.forEach((daySlots, dayIndex) => {
        daySlots.forEach((slot) => {
          flatSlots.push({ day: dayIndex, from: slot.from, to: slot.to });
        });
      });

      const savedSchedule = await api.schedule.replaceTeacherAvailability(
        teacher.id,
        flatSlots,
      );
      setSlots(slotsToByDay(savedSchedule?.slots));
      setSaved(true);
    } catch (err) {
      setError(
        userFacingError(
          err,
          'Не удалось сохранить график. Попробуйте ещё раз.',
        ),
      );
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const totalSlots = slots.reduce((sum, d) => sum + d.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-foreground">Мой свободный график</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Укажите, в какое время вы готовы принимать учеников</p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !teacher?.id}
          className={`gap-2 ${saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90"}`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Сохранение…" : saved ? "Сохранено!" : "Сохранить"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {totalSlots > 0 && (
        <div className="flex flex-wrap gap-2">
          {slots.map((daySlots, i) =>
            daySlots.length > 0 ? (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-soft dark:bg-brand-soft/30 text-brand dark:text-brand text-xs font-semibold rounded-full">
                {DAYS_SHORT[i]}
                {daySlots.map((s, j) => (
                  <span key={j} className="text-brand">{s.from}–{s.to}{j < daySlots.length - 1 ? "," : ""}</span>
                ))}
              </span>
            ) : null
          )}
        </div>
      )}

      <div className="space-y-3">
        {DAYS.map((dayName, dayIndex) => {
          const daySlots = slots[dayIndex];
          const hasSlots = daySlots.length > 0;
          return (
            <div
              key={dayIndex}
              className={`bg-card rounded-2xl border transition-colors ${hasSlots ? "border-brand/30 dark:border-brand/50" : "border-border"}`}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-32 flex-shrink-0">
                  <p className={`text-sm font-semibold ${hasSlots ? "text-foreground" : "text-muted-foreground"}`}>{dayName}</p>
                  <p className="text-xs text-muted-foreground">{DAYS_SHORT[dayIndex]}</p>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-3">
                  {daySlots.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic">Не указано</span>
                  ) : (
                    daySlots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="flex items-center gap-2 bg-brand-soft dark:bg-brand-soft/30 rounded-xl px-3 py-2">
                        <span className="text-xs text-muted-foreground font-medium">с</span>
                        <select
                          value={slot.from}
                          onChange={(e) => updateSlot(dayIndex, slotIndex, "from", e.target.value)}
                          className="text-sm font-semibold text-foreground bg-transparent border-none outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-xs text-muted-foreground font-medium">до</span>
                        <select
                          value={slot.to}
                          onChange={(e) => updateSlot(dayIndex, slotIndex, "to", e.target.value)}
                          className="text-sm font-semibold text-foreground bg-transparent border-none outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSlot(dayIndex, slotIndex)}
                          className="text-muted-foreground hover:text-red-400 transition-colors ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => addSlot(dayIndex)}
                    className="flex items-center gap-1 text-xs text-brand hover:text-brand font-medium transition-colors"
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
