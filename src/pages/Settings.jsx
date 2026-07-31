import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from '@/api';
import { chatsApi } from '@/api/chats.api';
import { useAuth } from "@/lib/AuthContext";
import { Sun, Moon, Download, Loader2, Pencil } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { getRoleBadgeClass, getRoleLabel } from "@/lib/locale-by";
import { createPageUrl } from "@/utils";
import AvatarEditor from "@/components/user/AvatarEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

const DM_POLICIES = [
  { value: 'all_registered', label: 'Все зарегистрированные' },
  { value: 'teachers_only', label: 'Только преподаватели' },
  { value: 'tutors_only', label: 'Только репетиторы' },
  { value: 'my_teachers', label: 'Мои преподаватели' },
  { value: 'my_tutors', label: 'Мои репетиторы' },
  { value: 'my_students', label: 'Мои ученики' },
  { value: 'my_course_members', label: 'Участники моих курсов' },
  { value: 'my_contacts', label: 'Мои контакты' },
  { value: 'nobody', label: 'Никто' },
];

/** Long emails / names: wrap inside cards without horizontal page scroll. */
const longTextClass =
  "min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word]";

function FieldCard({ label, children, className = "" }) {
  return (
    <div className={`bg-muted rounded-xl p-3 min-w-0 max-w-full overflow-hidden ${className}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className={`text-sm font-medium text-foreground ${longTextClass}`}>{children}</div>
    </div>
  );
}

function personLabel(u) {
  if (!u || typeof u !== "object") return "";
  return (
    [u.lastName || u.last_name, u.firstName || u.first_name].filter(Boolean).join(" ") ||
    u.email ||
    ""
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === "admin";
  const roleLabel = getRoleLabel(user?.role);
  const displayName =
    user?.full_name ||
    [user?.last_name, user?.first_name].filter(Boolean).join(" ").trim() ||
    "—";
  const [dmPolicy, setDmPolicy] = useState('my_teachers');
  const [privacySaving, setPrivacySaving] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [blockQuery, setBlockQuery] = useState('');
  const [blockCandidates, setBlockCandidates] = useState([]);

  useEffect(() => {
    void chatsApi.getPrivacy()
      .then((row) => setDmPolicy(row.dmPolicy || row.dm_policy || 'my_teachers'))
      .catch(() => {});
    void chatsApi.listBlocks()
      .then((rows) => setBlocks(Array.isArray(rows) ? rows : []))
      .catch(() => setBlocks([]));
  }, []);

  useEffect(() => {
    if (!blockQuery.trim()) {
      setBlockCandidates([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      void chatsApi.directory({ query: blockQuery })
        .then((rows) => setBlockCandidates(Array.isArray(rows) ? rows.slice(0, 8) : []))
        .catch(() => setBlockCandidates([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [blockQuery]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.functions.invoke('exportBackup', {});
      const base64Data = response.data.data;
      const jsonData = atob(base64Data);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Ошибка при экспорте: ' + error.message);
    }
    setExporting(false);
  };

  return (
    <div
      className="p-3 sm:p-6 w-full max-w-2xl mx-auto min-w-0 overflow-x-hidden"
      data-testid="settings-page"
    >
      <div className="mb-6 min-w-0">
        <h2 className="text-xl font-bold text-foreground break-words">Настройки</h2>
        <p className="text-sm text-muted-foreground break-words">Управление аккаунтом</p>
      </div>

      {user && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 pb-4 border-b border-border min-w-0">
            <div className="shrink-0">
              <AvatarEditor user={user} sizeClass="h-14 w-14" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3
                className={`text-base font-semibold text-foreground ${longTextClass}`}
                data-testid="settings-display-name"
              >
                {displayName}
              </h3>
              <p
                className={`text-sm text-muted-foreground ${longTextClass}`}
                data-testid="settings-email"
              >
                {user.email}
              </p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block max-w-full ${longTextClass} ${getRoleBadgeClass(user.role)}`}
                data-testid="settings-role-badge"
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            <FieldCard label="Имя">{displayName}</FieldCard>
            <FieldCard label="Эл. почта">
              <span data-testid="settings-email-field">{user.email || "—"}</span>
            </FieldCard>
            <FieldCard label="Роль">
              <span data-testid="settings-role-label">{roleLabel}</span>
            </FieldCard>
            <div className="bg-muted rounded-xl p-3 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-muted-foreground mb-0.5">Тема оформления</p>
                <p className={`text-sm font-medium text-foreground ${longTextClass}`}>
                  {theme === "dark" ? "Тёмная" : "Светлая"}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="shrink-0 p-2.5 min-h-11 min-w-11 rounded-lg border border-border bg-card text-muted-foreground hover:bg-brand-soft hover:text-brand transition-colors"
                title="Сменить тему"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>

            <Link
              to={createPageUrl("Profile")}
              className="flex items-center justify-center gap-2 w-full min-h-11 px-4 py-2.5 bg-brand-soft text-brand text-sm font-medium rounded-xl hover:bg-brand-muted transition-colors"
              data-testid="settings-edit-profile"
            >
              <Pencil className="h-4 w-4 shrink-0" />
              <span className="text-center break-words">Редактировать профиль</span>
            </Link>

            {isAdmin && (
              <div className="bg-muted rounded-xl p-3 border border-dashed border-border min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground mb-0.5">Техническая информация</p>
                <p className="text-[11px] text-muted-foreground mb-1 break-words">
                  ID пользователя (только для администратора)
                </p>
                <p className={`text-xs font-mono text-foreground ${longTextClass}`}>{user.id}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 mt-6 min-w-0 max-w-full overflow-hidden">
        <h3 className={`text-sm font-semibold text-foreground ${longTextClass}`}>
          Приватность → Личные сообщения
        </h3>
        <p className={`text-xs text-muted-foreground ${longTextClass}`}>
          Кто может отправлять вам запросы на переписку
        </p>
        <div className="space-y-2 min-w-0">
          {DM_POLICIES.map((policy) => (
            <label
              key={policy.value}
              className="flex items-start gap-2 text-sm cursor-pointer min-w-0"
            >
              <input
                type="radio"
                name="dmPolicy"
                className="mt-1 shrink-0"
                checked={dmPolicy === policy.value}
                onChange={() => setDmPolicy(policy.value)}
              />
              <span className={longTextClass}>{policy.label}</span>
            </label>
          ))}
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={privacySaving}
          onClick={async () => {
            setPrivacySaving(true);
            try {
              await chatsApi.updatePrivacy(dmPolicy);
              toast({ title: 'Политика сохранена' });
            } catch (err) {
              toast({
                title: 'Не удалось сохранить',
                description: err?.message,
                variant: 'destructive',
              });
            } finally {
              setPrivacySaving(false);
            }
          }}
        >
          {privacySaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Сохранить политику
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 mt-6 min-w-0 max-w-full overflow-hidden">
        <h3 className={`text-sm font-semibold text-foreground ${longTextClass}`}>Чёрный список</h3>
        <p className={`text-xs text-muted-foreground ${longTextClass}`}>
          Заблокированные пользователи не смогут писать и отправлять запросы
        </p>
        <Input
          value={blockQuery}
          onChange={(e) => setBlockQuery(e.target.value)}
          placeholder="Поиск пользователя…"
          className="min-w-0 max-w-full"
        />
        {blockCandidates.length > 0 ? (
          <ul className="space-y-2 max-h-48 overflow-y-auto overscroll-contain min-w-0">
            {blockCandidates.map((u) => (
              <li
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm min-w-0"
              >
                <span className={longTextClass}>
                  {personLabel(u) || u.email || "—"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto shrink-0"
                  onClick={async () => {
                    try {
                      await chatsApi.blockUser(u.id);
                      setBlocks(await chatsApi.listBlocks());
                      setBlockQuery('');
                      toast({ title: 'Пользователь заблокирован' });
                    } catch (err) {
                      toast({
                        title: 'Не удалось заблокировать',
                        description: err?.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Заблокировать
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="space-y-2 min-w-0">
          {blocks.map((row) => {
            const u = row.blockedUser || row.blocked_user || {};
            const name =
              personLabel(u) || u.email || row.blockedUserId || row.blocked_user_id;
            return (
              <li
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm min-w-0"
              >
                <span className={longTextClass}>{name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto shrink-0"
                  onClick={async () => {
                    try {
                      await chatsApi.unblockUser(row.blockedUserId || row.blocked_user_id);
                      setBlocks(await chatsApi.listBlocks());
                    } catch (err) {
                      toast({
                        title: 'Не удалось разблокировать',
                        description: err?.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Разблокировать
                </Button>
              </li>
            );
          })}
          {!blocks.length ? (
            <li className="text-xs text-muted-foreground">Список пуст</li>
          ) : null}
        </ul>
      </div>

      {isAdmin && (
        <>
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 mt-6 min-w-0 max-w-full overflow-hidden">
          <h3 className={`text-sm font-semibold text-foreground ${longTextClass}`}>Экспорт данных</h3>
          <p className={`text-xs text-muted-foreground ${longTextClass}`}>
            Скачайте полный архив всех данных системы
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="break-words">Экспортирование...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 shrink-0" />
                <span className="break-words">Скачать резервную копию</span>
              </>
            )}
          </button>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 mt-6 min-w-0 max-w-full overflow-hidden">
          <h3 className={`text-sm font-semibold text-foreground ${longTextClass}`}>
            Права доступа по ролям
          </h3>
          {[
            { role: "Администратор", tone: "brand", perms: ["Полный доступ ко всем функциям", "Управление учениками и преподавателями", "Запись платежей", "Просмотр финансовых данных", "Расписание уроков", "Настройки Телеграм-бота", "Управление ожидающими пользователями"] },
            { role: "Преподаватель", tone: "emerald", perms: ["Просмотр своего расписания", "Отметка уроков как завершённых/отменённых", "Просмотр имён учеников", "Нет доступа к финансовым данным"] },
            { role: "Репетитор", tone: "sky", perms: ["Своё расписание", "Свои ученики репетитора", "Реферальные ссылки", "Статистика занятий", "Без доступа к ученикам школы и зарплате"] },
            { role: "Ученик", tone: "neutral", perms: ["Просмотр предстоящих уроков", "Просмотр календаря уроков", "Просмотр остатка баланса", "Доступ к ссылкам на встречи"] },
            { role: "Ученик репетитора", tone: "cyan", perms: ["Профиль и настройки", "Занятия только у своего репетитора", "Без доступа к школьным группам"] },
            { role: "Ожидающий", tone: "amber", perms: ["Нет доступа к кабинетам", "Только страница ожидания", "Доступ откроется после назначения роли администратором"] },
          ].map(({ role, tone, perms }) => (
            <div key={role} className={`rounded-xl border p-4 min-w-0 overflow-hidden ${
              tone === "brand" ? "border-brand/20 bg-brand-soft/50 dark:bg-brand-soft/30" :
              tone === "emerald" ? "border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50" :
              tone === "sky" ? "border-sky-100 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900/50" :
              tone === "cyan" ? "border-cyan-100 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/50" :
              tone === "amber" ? "border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50" :
              "border-border bg-muted/50"
            }`}>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full mb-3 inline-block max-w-full ${longTextClass} ${
                tone === "brand" ? "bg-brand-muted text-brand" :
                tone === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" :
                tone === "sky" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" :
                tone === "cyan" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" :
                tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              }`}>{role}</span>
              <ul className="space-y-1 min-w-0">
                {perms.map(p => (
                  <li key={p} className="flex items-start gap-2 text-xs text-muted-foreground min-w-0">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 flex-shrink-0 mt-1.5" />
                    <span className={longTextClass}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
