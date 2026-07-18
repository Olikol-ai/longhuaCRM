import { useState } from "react";
import { X, Edit2, Trash2, GraduationCap, CalendarDays } from "lucide-react";
import TeacherAvailabilityView from "./TeacherAvailabilityView";

export default function TeacherDetailModal({ teacher, students, onEdit, onDelete, onClose }) {
  const [tab, setTab] = useState("info");
  const myStudents = students.filter(s => s.assigned_teacher === teacher.id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{teacher.name[0]}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{teacher.name}</h3>
              <span className={`text-[10px] font-semibold uppercase ${teacher.status === "active" ? "text-emerald-600" : "text-slate-400 dark:text-slate-500"}`}>
                {teacher.status || "active"}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(teacher)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 dark:text-slate-500 rounded-lg">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => { onDelete(teacher.id); onClose(); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 dark:hover:text-red-400 text-slate-400 dark:text-slate-500 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-100 dark:border-slate-800">
          {[{id: "info", label: "Информация"}, {id: "availability", label: "Свободный график"}].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
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
              ["Email", teacher.email],
              ["Ставка", teacher.hourly_rate ? `${teacher.hourly_rate} BYN/ч` : null],
              ["Telegram", teacher.telegram_id],
              ["Специализации", teacher.specializations],
            ].map(([label, val]) => val ? (
              <div key={label} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{val}</p>
              </div>
            ) : null)}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" />
              Ученики ({myStudents.length})
            </h4>
            <div className="space-y-1.5">
              {myStudents.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Нет прикреплённых учеников</p>
              ) : (
                myStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-indigo-600">{s.name[0]}</span>
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-200">{s.name}</span>
                    <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{s.lesson_balance || 0} уроков</span>
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
