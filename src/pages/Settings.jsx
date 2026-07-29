import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import { Sun, Moon, Download, Loader2, Pencil } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { getRoleBadgeClass, getRoleLabel } from "@/lib/locale-by";
import { createPageUrl } from "@/utils";
import AvatarEditor from "@/components/user/AvatarEditor";

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
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Настройки</h2>
        <p className="text-sm text-muted-foreground">Управление аккаунтом</p>
      </div>

      {user && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <AvatarEditor user={user} sizeClass="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground" data-testid="settings-display-name">
                {displayName}
              </h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${getRoleBadgeClass(user.role)}`}
                data-testid="settings-role-badge"
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Имя</p>
              <p className="text-sm font-medium text-foreground">{displayName}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Эл. почта</p>
              <p className="text-sm font-medium text-foreground">{user.email || "—"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Роль</p>
              <p className="text-sm font-medium text-foreground" data-testid="settings-role-label">
                {roleLabel}
              </p>
            </div>
            <div className="bg-muted rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Тема оформления</p>
                <p className="text-sm font-medium text-foreground">
                  {theme === "dark" ? "Тёмная" : "Светлая"}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-brand-soft hover:text-brand transition-colors"
                title="Сменить тему"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>

            <Link
              to={createPageUrl("Profile")}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-brand-soft text-brand text-sm font-medium rounded-xl hover:bg-brand-muted transition-colors"
              data-testid="settings-edit-profile"
            >
              <Pencil className="h-4 w-4" />
              Редактировать профиль
            </Link>

            {isAdmin && (
              <div className="bg-muted rounded-xl p-3 border border-dashed border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Техническая информация</p>
                <p className="text-[11px] text-muted-foreground mb-1">ID пользователя (только для администратора)</p>
                <p className="text-xs font-mono text-foreground break-all">{user.id}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <>
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 mt-6">
          <h3 className="text-sm font-semibold text-foreground">Экспорт данных</h3>
          <p className="text-xs text-muted-foreground">Скачайте полный архив всех данных системы</p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Экспортирование...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Скачать резервную копию
              </>
            )}
          </button>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 mt-6">
          <h3 className="text-sm font-semibold text-foreground">Права доступа по ролям</h3>
          {[
            { role: "Администратор", tone: "brand", perms: ["Полный доступ ко всем функциям", "Управление учениками и преподавателями", "Запись платежей", "Просмотр финансовых данных", "Расписание уроков", "Настройки Телеграм-бота", "Управление ожидающими пользователями"] },
            { role: "Преподаватель", tone: "emerald", perms: ["Просмотр своего расписания", "Отметка уроков как завершённых/отменённых", "Просмотр имён учеников", "Нет доступа к финансовым данным"] },
            { role: "Репетитор", tone: "sky", perms: ["Своё расписание", "Свои ученики репетитора", "Реферальные ссылки", "Статистика занятий", "Без доступа к ученикам школы и зарплате"] },
            { role: "Ученик", tone: "neutral", perms: ["Просмотр предстоящих уроков", "Просмотр календаря уроков", "Просмотр остатка баланса", "Доступ к ссылкам на встречи"] },
            { role: "Ученик репетитора", tone: "cyan", perms: ["Профиль и настройки", "Занятия только у своего репетитора", "Без доступа к школьным группам"] },
            { role: "Ожидающий", tone: "amber", perms: ["Нет доступа к кабинетам", "Только страница ожидания", "Доступ откроется после назначения роли администратором"] },
          ].map(({ role, tone, perms }) => (
            <div key={role} className={`rounded-xl border p-4 ${
              tone === "brand" ? "border-brand/20 bg-brand-soft/50 dark:bg-brand-soft/30" :
              tone === "emerald" ? "border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50" :
              tone === "sky" ? "border-sky-100 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900/50" :
              tone === "cyan" ? "border-cyan-100 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/50" :
              tone === "amber" ? "border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50" :
              "border-border bg-muted/50"
            }`}>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full mb-3 inline-block ${
                tone === "brand" ? "bg-brand-muted text-brand" :
                tone === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" :
                tone === "sky" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" :
                tone === "cyan" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" :
                tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              }`}>{role}</span>
              <ul className="space-y-1">
                {perms.map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 flex-shrink-0" /> {p}
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
