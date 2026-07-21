import { Loader2, Clock } from "lucide-react";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dayIndexFromDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export default function TeacherAvailabilityPanel({
  loading,
  hasSchedule,
  slotsForDay,
  selectedDate,
}) {
  if (!selectedDate) {
    return null;
  }

  const dayIndex = dayIndexFromDate(selectedDate);
  const dayLabel = dayIndex != null ? DAYS[dayIndex] : "";

  if (loading) {
    return (
      <div className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        Загрузка расписания преподавателя…
      </div>
    );
  }

  if (!hasSchedule) {
    return (
      <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
        <span className="font-semibold">Расписание не задано</span>
        <span className="text-emerald-700"> — преподаватель доступен в любое время.</span>
      </div>
    );
  }

  return (
    <div className="col-span-2 rounded-xl border border-brand/30 dark:border-brand/50 bg-brand-soft/60 dark:bg-brand-soft/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-hover dark:text-brand mb-1.5">
        <Clock className="h-3.5 w-3.5" />
        Свободные слоты ({dayLabel})
      </div>
      {slotsForDay.length === 0 ? (
        <p className="text-xs text-amber-700">В этот день преподаватель не работает.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slotsForDay.map((slot, index) => (
            <span
              key={`${slot.from}-${slot.to}-${index}`}
              className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
            >
              {slot.from} – {slot.to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export { dayIndexFromDate };
