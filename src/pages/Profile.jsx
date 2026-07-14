import { useState, useEffect, useRef } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Save, CheckCircle2, User, Send, Link2, Loader2, Unlink } from "lucide-react";
import { formatBelarusPhone, PHONE_PLACEHOLDER } from "@/utils/phone";

export default function Profile() {
  const { user, isLoadingAuth, checkAppState } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", birthday: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [waitingLink, setWaitingLink] = useState(false);
  const [tgStatus, setTgStatus] = useState(null);
  const pollRef = useRef(null);

  const loadTelegramStatus = async () => {
    try {
      const status = await api.telegram.linkStatus();
      setTgStatus(status);
      return status;
    } catch {
      const fallback = { connected: false, username: null, connected_at: null };
      setTgStatus(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      let birthday = "";
      if (user.role === "student" || user.has_student_profile) {
        const students = user.student_profile_id
          ? await api.students.filter({ id: user.student_profile_id })
          : await api.students.filter({ user_id: user.id });
        birthday = students[0]?.birthday || "";
      }

      setForm({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone ? formatBelarusPhone(user.phone) : "",
        birthday,
      });
      await loadTelegramStatus();
    })();
  }, [user]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWaitingLink(false);
  };

  const startStatusPolling = () => {
    stopPolling();
    setWaitingLink(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const status = await loadTelegramStatus();
      if (status?.connected) {
        stopPolling();
        await checkAppState({ force: true });
        return;
      }
      if (attempts >= 36) {
        stopPolling();
      }
    }, 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    await api.auth.updateMe({
      ...(user.role !== 'admin' ? { email: form.email.trim() } : {}),
      phone: form.phone,
    });

    if (user.role === "student" || user.has_student_profile) {
      const students = user.student_profile_id
        ? await api.students.filter({ id: user.student_profile_id })
        : await api.students.filter({ user_id: user.id });
      if (students.length > 0 && form.birthday !== undefined) {
        await api.students.update(students[0].id, {
          birthday: form.birthday,
        });
      }
    }

    await checkAppState({ force: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTelegramLink = async () => {
    setLinking(true);
    try {
      const created = await api.telegram.createLink();
      if (created?.link) {
        window.open(created.link, '_blank', 'noopener,noreferrer');
      }
      startStatusPolling();
    } catch (err) {
      alert(err.message || 'Не удалось создать ссылку');
    } finally {
      setLinking(false);
    }
  };

  const handleTelegramUnlink = async () => {
    if (!confirm('Отвязать Telegram от аккаунта?')) return;
    setUnlinking(true);
    try {
      stopPolling();
      await api.telegram.unlink();
      await loadTelegramStatus();
      await checkAppState({ force: true });
    } catch (err) {
      alert(err.message || 'Не удалось отвязать Telegram');
    } finally {
      setUnlinking(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const roleLabel = { admin: "Администратор", teacher: "Преподаватель", student: "Ученик", pending: "Ожидает роли" };
  const roleColor = { admin: "bg-violet-100 text-violet-700", teacher: "bg-emerald-100 text-emerald-700", student: "bg-sky-100 text-sky-700", pending: "bg-amber-100 text-amber-700" };

  if (isLoadingAuth || !user) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const connected = Boolean(tgStatus?.connected);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Профиль</h2>
        <p className="text-sm text-slate-400">Ваши личные данные</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{(user.full_name || user.email || "U")[0].toUpperCase()}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{user.full_name || "—"}</h3>
          <p className="text-sm text-slate-400">{form.email || user.email}</p>
          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full mt-1.5 inline-block ${roleColor[user.role] || roleColor.pending}`}>
            {roleLabel[user.role] || user.role}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" /> Контактные данные
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ФИО</label>
          <input value={form.full_name} disabled
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={form.email}
            onChange={e => set("email", e.target.value)}
            disabled={user.role === 'admin'}
            className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${user.role === 'admin' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Телефон</label>
          <input type="tel" value={form.phone}
            onChange={e => set("phone", formatBelarusPhone(e.target.value))}
            placeholder={PHONE_PLACEHOLDER}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>

        {user.has_student_profile && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Дата рождения</label>
            <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" /> Telegram
        </h3>
        <div className="border-t border-slate-100" />

        {connected ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-700">✅ Подключён</p>
            <button type="button" onClick={handleTelegramUnlink} disabled={unlinking}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Отвязать Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-amber-700">
              ⚠️ Не подключён{waitingLink ? ' — ожидаем привязку…' : ''}
            </p>
            <button type="button" onClick={handleTelegramLink} disabled={linking}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50">
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Привязать Telegram
            </button>
          </div>
        )}
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
