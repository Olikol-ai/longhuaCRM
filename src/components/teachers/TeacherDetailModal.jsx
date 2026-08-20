import { useState } from "react";
import { X, Edit2, Trash2, GraduationCap } from "lucide-react";
import TeacherAvailabilityView from "./TeacherAvailabilityView";
import { localizeEntityStatus } from "@/lib/locale-by";
import { formatHourlyRateShort } from "@/lib/formatters";
import LessonBalanceDisplay from "@/components/students/LessonBalanceDisplay";

export default function TeacherDetailModal({ teacher, students, onEdit, onDelete, onClose }) {
  const [tab, setTab] = useState("info");
  const myStudents = students.filter(s => s.assigned_teacher === teacher.id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-brand-active flex items-center justify-center">
              <span className="text-sm font-bold text-white">{teacher.name[0]}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{teacher.name}</h3>
              <span className={`text-[10px] font-semibold uppercase ${teacher.status === "active" ? "text-emerald-600" : "text-muted-foreground"}`}>
                {localizeEntityStatus(teacher.status || "active")}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(teacher)} className="p-1.5 hover:bg-brand-soft dark:hover:bg-brand-soft/50 hover:text-brand dark:hover:text-brand text-muted-foreground rounded-lg">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => { onDelete(teacher.id); onClose(); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 dark:hover:text-red-400 text-muted-foreground rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-muted text-muted-foreground rounded-lg ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border">
          {[{id: "info", label: "Информация"}, {id: "availability", label: "Свободный график"}].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-brand text-brand dark:text-brand" : "border-transparent text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "info" && (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["Эл. почта", teacher.email],
              ["Ставка", teacher.hourly_rate != null && teacher.hourly_rate !== '' ? formatHourlyRateShort(teacher.hourly_rate) : null],
              ["Телеграм", teacher.telegram_id],
              ["Специализации", teacher.specializations],
            ].map(([label, val]) => val ? (
              <div key={label} className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-medium text-foreground">{val}</p>
              </div>
            ) : null)}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" />
              Ученики ({myStudents.length})
            </h4>
            <div className="space-y-1.5">
              {myStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет прикреплённых учеников</p>
              ) : (
                myStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                    <div className="w-6 h-6 rounded-full bg-brand-muted flex items-center justify-center">
                      <span className="text-[10px] font-bold text-brand">{s.name[0]}</span>
                    </div>
                    <span className="text-sm text-foreground">{s.name}</span>
                    <LessonBalanceDisplay row={s} className="ml-auto text-xs" suffix=" ур." />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {tab === "availability" && (
          <div className="p-6">
            <TeacherAvailabilityView teacherId={teacher.id} />
          </div>
        )}
      </div>
    </div>
  );
}
