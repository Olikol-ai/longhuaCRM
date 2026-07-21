import { useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";

const fieldCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40";

export default function PaymentModal({ students, onSave, onClose, initialData }) {
  const [form, setForm] = useState({
    student_id: initialData?.student_id || "",
    amount: initialData?.amount ?? "",
    lessons_added: initialData?.lessons_added ?? "",
    payment_date: initialData?.payment_date || format(new Date(), "yyyy-MM-dd"),
    comment: initialData?.comment || "",
  });

  const isEdit = !!initialData;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.student_id || !form.amount || !form.lessons_added) return;
    const student = students.find(s => s.id === form.student_id);
    onSave({
      ...form,
      student_name: student?.name || initialData?.student_name || "",
      amount: +form.amount,
      lessons_added: +form.lessons_added,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl w-full max-w-md shadow-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{isEdit ? "Редактировать платёж" : "Добавить платёж"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ученик *</label>
            <select value={form.student_id} onChange={e => set("student_id", e.target.value)} className={fieldCls}>
              <option value="">Выбрать ученика</option>
              {students.filter(s => s.status !== "inactive").map(s => (
                <option key={s.id} value={s.id}>{s.name} (баланс: {s.lesson_balance || 0})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Сумма (BYN) *</label>
              <input type="number" min="0" value={form.amount} onChange={e => set("amount", e.target.value)}
                placeholder="0.00" className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Куплено уроков *</label>
              <input type="number" min="1" value={form.lessons_added} onChange={e => set("lessons_added", e.target.value)}
                placeholder="0" className={fieldCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Дата платежа</label>
            <input type="date" value={form.payment_date} onChange={e => set("payment_date", e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Комментарий</label>
            <textarea value={form.comment} onChange={e => set("comment", e.target.value)} rows={2}
              placeholder="Необязательная заметка..." className={`${fieldCls} resize-none`} />
          </div>

          {form.student_id && form.lessons_added && (
            <div className="bg-brand-soft dark:bg-brand-soft/40 rounded-xl p-3 text-sm text-brand dark:text-brand">
              Сумма: <strong>{form.amount} BYN</strong> · Баланс увеличится на <strong>{form.lessons_added}</strong> уроков
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg">Отмена</button>
          <button onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            {isEdit ? "Сохранить изменения" : "Сохранить платёж"}
          </button>
        </div>
      </div>
    </div>
  );
}
