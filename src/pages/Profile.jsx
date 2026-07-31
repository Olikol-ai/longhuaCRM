import { useState, useEffect, useRef } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/locale-by';
import { Save, CheckCircle2, User, Send, Link2, Loader2, Unlink, Copy, Users, Pencil, X } from "lucide-react";
import { formatBelarusPhone, isValidBelarusPhone, PHONE_PLACEHOLDER } from "@/utils/phone";
import { toast } from "@/components/ui/use-toast";
import { userFacingError } from "@/lib/userFacingError";
import AvatarEditor from "@/components/user/AvatarEditor";

function inviteStorageKey(userId) {
  return `longhua_teacher_invite_url_${userId}`;
}

function inviteUrlFromResponse(created) {
  if (!created) return '';
  if (created.path) {
    return `${window.location.origin}${created.path}`;
  }
  if (created.token) {
    return `${window.location.origin}/register?ref=${encodeURIComponent(created.token)}`;
  }
  return '';
}

function isActiveInvite(row) {
  if (!row || row.revoked_at) return false;
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  return expires > Date.now();
}

function countNameWords(fullName) {
  return String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function Profile() {
  const { user, isLoadingAuth, checkAppState, establishSession } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", birthday: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [waitingLink, setWaitingLink] = useState(false);
  const [tgStatus, setTgStatus] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const pollRef = useRef(null);
  const refreshedSessionRef = useRef(false);

  // Refresh /auth/me once so admin-renamed FIO appears without re-login.
  useEffect(() => {
    if (isLoadingAuth || refreshedSessionRef.current) return;
    refreshedSessionRef.current = true;
    void establishSession?.({ force: true });
  }, [establishSession, isLoadingAuth]);

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

      if (user.role === "teacher") {
        try {
          const cached = sessionStorage.getItem(inviteStorageKey(user.id));
          if (cached) {
            setInviteUrl(cached);
          }
          const rows = await api.teacherInvites.list();
          const list = Array.isArray(rows) ? rows : [];
          const hasActive = list.some(isActiveInvite);
          if (!hasActive) {
            const created = await api.teacherInvites.create();
            const url = inviteUrlFromResponse(created);
            setInviteUrl(url);
            if (url) sessionStorage.setItem(inviteStorageKey(user.id), url);
          }
        } catch {
          // Invite block stays empty; teacher can create manually.
        }
      }
    })();
  }, [user]);

  const ensureTeacherInvite = async () => {
    setInviteBusy(true);
    try {
      const created = await api.teacherInvites.create();
      const url = inviteUrlFromResponse(created);
      setInviteUrl(url);
      if (url && user?.id) {
        sessionStorage.setItem(inviteStorageKey(user.id), url);
      }
      toast({ title: "Ссылка для регистрации создана" });
      return url;
    } catch (err) {
      toast({
        title: "Не удалось создать ссылку",
        description: err?.message,
        variant: "destructive",
      });
      return '';
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    let url = inviteUrl;
    if (!url) {
      url = await ensureTeacherInvite();
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Скопируйте ссылку вручную", description: url });
    }
  };

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

  const resetFormFromUser = () => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone ? formatBelarusPhone(user.phone) : "",
    }));
  };

  const handleCancelEdit = () => {
    resetFormFromUser();
    setEditing(false);
  };

  const handleSave = async () => {
    const fullName = form.full_name.trim();
    if (countNameWords(fullName) < 2) {
      toast({
        title: "Проверьте ФИО",
        description: "Укажите фамилию и имя (минимум два слова).",
        variant: "destructive",
      });
      return;
    }

    const phone = form.phone.trim();
    if (phone && !isValidBelarusPhone(phone)) {
      toast({
        title: "Некорректный телефон",
        description: `Используйте формат ${PHONE_PLACEHOLDER}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await api.auth.updateMe({
        full_name: fullName,
        ...(user.role !== 'admin' ? { email: form.email.trim() } : {}),
        phone,
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
      setEditing(false);
      setSaved(true);
      toast({ title: "Профиль обновлён", description: "Данные сохранены." });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({
        title: "Не удалось сохранить",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
      alert(
        userFacingError(
          err,
          'Интеграция Telegram временно недоступна. Обратитесь к администратору.',
        ),
      );
    } finally {
      setLinking(false);
    }
  };

  const handleTelegramUnlink = async () => {
    if (!confirm('Отвязать Телеграм от аккаунта?')) return;
    setUnlinking(true);
    try {
      stopPolling();
      await api.telegram.unlink();
      await loadTelegramStatus();
      await checkAppState({ force: true });
    } catch (err) {
      alert(
        userFacingError(
          err,
          'Не удалось отвязать Телеграм. Попробуйте ещё раз.',
        ),
      );
    } finally {
      setUnlinking(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (isLoadingAuth || !user) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const connected = Boolean(tgStatus?.connected);
  const inputClass = editing
    ? "w-full min-w-0 max-w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 bg-white dark:bg-slate-900"
    : "w-full min-w-0 max-w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed break-words";

  return (
    <div className="p-3 sm:p-6 w-full max-w-2xl mx-auto space-y-6 min-w-0 overflow-x-hidden" data-testid="profile-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Профиль</h2>
          <p className="text-sm text-slate-400">Ваши личные данные</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-soft text-brand text-sm font-medium rounded-xl hover:bg-brand-muted transition-colors"
            data-testid="profile-edit-button"
          >
            <Pencil className="w-4 h-4" />
            Редактировать профиль
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            data-testid="profile-cancel-edit"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 overflow-hidden">
        <div className="shrink-0">
          <AvatarEditor user={user} sizeClass="h-16 w-16" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h3
            className="text-lg font-semibold text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere]"
            data-testid="profile-header-name"
          >
            {user.full_name || "—"}
          </h3>
          <p className="text-sm text-slate-400 break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {form.email || user.email}
          </p>
          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full mt-1.5 inline-block max-w-full break-words ${getRoleBadgeClass(user.role)}`}>
            {getRoleLabel(user.role)}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" /> Контактные данные
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ФИО</label>
          <input
            value={form.full_name}
            onChange={e => set("full_name", e.target.value)}
            disabled={!editing}
            className={inputClass}
            data-testid="profile-full-name"
            autoComplete="name"
          />
          {editing && (
            <p className="mt-1 text-xs text-slate-400">Фамилия и имя — минимум два слова</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Эл. почта</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            disabled={!editing || user.role === 'admin'}
            className={
              !editing || user.role === 'admin'
                ? "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed"
                : inputClass
            }
            data-testid="profile-email"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Телефон</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set("phone", formatBelarusPhone(e.target.value))}
            placeholder={PHONE_PLACEHOLDER}
            disabled={!editing}
            className={inputClass}
            data-testid="profile-phone"
          />
        </div>

        {user.has_student_profile && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Дата рождения</label>
            <input
              type="date"
              value={form.birthday}
              onChange={e => set("birthday", e.target.value)}
              disabled={!editing}
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Send className="w-4 h-4 text-brand" /> Телеграм
        </h3>
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {connected ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-700">✅ Подключён</p>
            <button type="button" onClick={handleTelegramUnlink} disabled={unlinking}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Отвязать Телеграм
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-amber-700">
              ⚠️ Не подключён{waitingLink ? ' — ожидаем привязку…' : ''}
            </p>
            <button type="button" onClick={handleTelegramLink} disabled={linking}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-soft text-brand text-sm font-medium rounded-xl hover:bg-brand-muted transition-colors disabled:opacity-50">
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Привязать Телеграм
            </button>
          </div>
        )}
      </div>

      {user.role === "teacher" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3" data-testid="teacher-invite-profile-block">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" /> Ссылка для регистрации учеников
          </h3>
          <div className="border-t border-slate-100 dark:border-slate-800" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Отправьте ссылку ученику. После регистрации и подтверждения email он автоматически закрепится за вами.
          </p>
          {inviteUrl ? (
            <p className="text-xs break-all text-brand bg-brand-soft dark:bg-brand-soft/40 rounded-lg px-3 py-2" data-testid="teacher-invite-profile-url">
              {inviteUrl}
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Ссылка ещё не готова. Нажмите «Создать ссылку», затем «Скопировать».
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!inviteUrl && (
              <button
                type="button"
                onClick={ensureTeacherInvite}
                disabled={inviteBusy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="teacher-invite-profile-create"
              >
                {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Создать ссылку
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyInvite}
              disabled={inviteBusy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              data-testid="teacher-invite-profile-copy"
            >
              {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Скопировать
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="profile-save-button"
          >
            {saved
              ? <><CheckCircle2 className="w-4 h-4" /> Сохранено!</>
              : saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
                : <><Save className="w-4 h-4" /> Сохранить</>}
          </button>
        </div>
      )}
    </div>
  );
}
