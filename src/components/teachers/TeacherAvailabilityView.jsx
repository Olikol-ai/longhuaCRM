import { useState, useEffect } from "react";
import { api } from '@/api';
import { Loader2 } from "lucide-react";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function TeacherAvailabilityView({ teacherId }) {
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.schedule.getTeacherAvailability(teacherId).then((availability) => {
      const byDay = Array.from({ length: 7 }, () => []);
      (availability?.slots || []).forEach((slot) => {
        byDay[slot.day] = [...byDay[slot.day], { from: slot.from, to: slot.to }];
      });
      setSlots(byDay);
      setLoading(false);
    });
  }, [teacherId]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
    </div>
  );

  const hasAny = slots.some(d => d.length > 0);

  if (!hasAny) return (
    <p className="text-sm text-slate-400 text-center py-8">Преподаватель ещё не заполнил свой график</p>
  );

  return (
    <div className="space-y-2">
      {slots.map((daySlots, i) => (
        <div key={i} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${daySlots.length > 0 ? "bg-indigo-50" : "bg-slate-50/50"}`}>
          <span className={`text-xs font-bold w-7 text-center shrink-0 ${daySlots.length > 0 ? "text-indigo-700" : "text-slate-300"}`}>
            {DAYS_SHORT[i]}
          </span>
          <span className={`text-xs flex-shrink-0 hidden sm:block w-24 ${daySlots.length > 0 ? "text-slate-600" : "text-slate-300"}`}>
            {DAYS[i]}
          </span>
          {daySlots.length === 0 ? (
            <span className="text-xs text-slate-300 italic">—</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {daySlots.map((slot, j) => (
                <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg shadow-sm">
                  {slot.from} – {slot.to}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}