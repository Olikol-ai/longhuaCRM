import { useState, useEffect } from "react";
import { api } from '@/api';
import { Save, CheckCircle2, User, Send } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ full_name: "", phone: "", telegram_id: "", birthday: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.auth.me().then(async u => {
      setUser(u);
      let telegramId = u.telegram_id || "";
      let birthday = "";

      if (u.role === "student") {
        const students = await api.entities.Student.filter({ user_id: u.id });
        birthday = students[0]?.birthday || "";
        if (!telegramId && students[0]?.telegram_id) telegramId = students[0].telegram_id;
      } else if (u.role === "teacher") {
        let teachers = await api.entities.Teacher.filter({ user_id: u.id });
        if (!teachers.length) teachers = await api.entities.Teacher.filter({ email: u.email });
        if (!telegramId && teachers[0]?.telegram_id) telegramId = teachers[0].telegram_id;
      }

      setForm({
        full_name: u.full_name || "",
        phone: u.phone || "",
        telegram_id: telegramId,
        birthday,
      });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const prevTelegramId = user.telegram_id || "";
    await api.auth.updateMe({ phone: form.phone, telegram_id: form.telegram_id });

    // Sync telegram_id to Student OR Teacher entity depending on role
    if (user.role === "student") {
      const students = await api.entities.Student.filter({ user_id: user.id });
      if (students.length > 0) {
        await api.entities.Student.update(students[0].id, { telegram_id: form.telegram_id, birthday: form.birthday });
      }
    } else if (user.role === "teacher") {
      let teachers = await api.entities.Teacher.filter({ user_id: user.id });
      if (!teachers.length) teachers = await api.entities.Teacher.filter({ email: user.email });
      if (teachers.length > 0) {
        await api.entities.Teacher.update(teachers[0].id, { telegram_id: form.telegram_id, user_id: user.id });
      }
    }

    // Send activation message if telegram_id was just set or changed
    if (form.telegram_id && form.telegram_id !== prevTelegramId) {
      const name = user.full_name?.split(" ")[1] || "Пользователь";
      const message = `🎉 Уведомления активированы!\n\nПривет, ${name}! Ваш Telegram подключён к платформе Longhua Chinese 🐉\n\nТеперь вы будете получать уведомления об уроках и важных событиях. Удачи! 加油！`;
      api.functions.invoke("sendTelegramMessage", { chat_id: form.telegram_id, text: message }).catch(() => {});
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const roleLabel = { admin: "Администратор", teacher: "Преподаватель", student: "Ученик", pending: "Ожидает роли" };
  const roleColor = { admin: "bg-violet-100 text-violet-700", teacher: "bg-emerald-100 text-emerald-700", student: "bg-sky-100 text-sky-700", pending: "bg-amber-100 text-amber-700" };

  if (!user) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Профиль</h2>
        <p className="text-sm text-slate-400">Ваши личные данные</p>
      </div>

      {/* Avatar card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{(user.full_name || user.email || "U")[0].toUpperCase()}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{user.full_name || "—"}</h3>
          <p className="text-sm text-slate-400">{user.email}</p>
          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full mt-1.5 inline-block ${roleColor[user.role] || roleColor.pending}`}>
            {roleLabel[user.role] || user.role}
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" /> Контактные данные
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ФИО</label>
          <input value={form.full_name} disabled
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
          <p className="text-xs text-slate-400 mt-1">Имя задаётся через систему аутентификации</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Телефон</label>
          <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="+7 900 000 00 00"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input value={user.email} disabled
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" /> Telegram
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Telegram ID</label>
            <input value={form.telegram_id} onChange={e => set("telegram_id", e.target.value)}
              placeholder="123456789"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Дата рождения</label>
            <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-2">
          <p>
            Чтобы узнать свой Telegram ID — напишите боту{" "}
            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline font-medium">@userinfobot</a>.
          </p>
          <p>
            Затем обязательно напишите{" "}
            <a href="https://t.me/LonghuaChinese_bot" target="_blank" rel="noopener noreferrer" className="underline font-medium">@LonghuaChinese_bot</a>
            {" "}команду <span className="font-mono bg-blue-100 px-1 rounded">/start</span> — без этого шага уведомления не придут.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saved
            ? <><CheckCircle2 className="w-4 h-4" /> Сохранено!</>
            : saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : <><Save className="w-4 h-4" /> Сохранить</>}
        </button>
      </div>
    </div>
  );
}