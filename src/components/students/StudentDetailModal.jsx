import { useState, useEffect } from "react";
import { api } from '@/api';
import { X, Edit2, Trash2, Phone, Mail, MessageSquare, BookOpen, Clock, CreditCard } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function StudentDetailModal({ student, teachers, onEdit, onDelete, onClose, onRefresh }) {
  const [lessons, setLessons] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("info");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.Lesson.filter({ student_id: student.id }),
      api.entities.Payment.filter({ student_id: student.id }),
    ]).then(([l, p]) => {
      setLessons(l.sort((a, b) => b.date?.localeCompare(a.date)));
      setPayments(p.sort((a, b) => b.payment_date?.localeCompare(a.payment_date)));
      setLoading(false);
    });
  }, [student.id]);

  const teacherName = teachers.find(t => t.id === student.assigned_teacher)?.name || "—";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-600">{student.name[0]}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{student.name}</h3>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                student.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              }`}>{student.status || "active"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(student)} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => { onDelete(student.id); onClose(); }} className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {["info", "lessons", "payments"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Info icon={Mail} label="Email" value={student.email} />
                <Info icon={Phone} label="Phone" value={student.phone} />
                <Info icon={MessageSquare} label="Telegram ID" value={student.telegram_id} />
                <Info icon={BookOpen} label="Assigned Teacher" value={teacherName} />
                <Info icon={Clock} label="Start Date" value={student.start_date} />
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs text-indigo-400 font-medium mb-0.5">Lesson Balance</p>
                  <p className="text-2xl font-bold text-indigo-700">{student.lesson_balance || 0}</p>
                </div>
              </div>
              {student.notes && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{student.notes}</p>
                </div>
              )}
            </div>
          )}

          {tab === "lessons" && (
            <div className="space-y-1">
              {loading ? <Spinner /> : lessons.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No lessons yet</p>
              ) : (
                lessons.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      l.status === "completed" ? "bg-emerald-400" :
                      l.status === "cancelled" ? "bg-red-400" : "bg-sky-400"
                    }`} />
                    <span className="text-sm text-slate-700 flex-1">{l.date} at {l.start_time}</span>
                    <span className="text-xs text-slate-400">{l.teacher_name}</span>
                    <span className="text-xs capitalize text-slate-400">{l.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-1">
              {loading ? <Spinner /> : payments.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No payments yet</p>
              ) : (
                payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">${p.amount}</p>
                      <p className="text-xs text-slate-400">{p.lessons_added} lessons · {p.payment_date}</p>
                    </div>
                    {p.comment && <p className="text-xs text-slate-400">{p.comment}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-slate-400" />
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
      <p className="text-sm text-slate-700 font-medium">{value || "—"}</p>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
}