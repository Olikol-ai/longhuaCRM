import { useState } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import { User, Shield, Sun, Moon, Download, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

export default function Settings() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const { theme, toggleTheme } = useTheme();

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

  const roleLabel = { admin: "Администратор", teacher: "Преподаватель", student: "Ученик", pending: "Ожидает роли" };
  const roleColor = {
    admin: "bg-brand-muted text-brand",
    teacher: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    student: "bg-muted text-muted-foreground",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-brand-active flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">{(user.full_name || user.email || "U")[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{user.full_name || "—"}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${roleColor[user.role] || roleColor.pending}`}>
                {roleLabel[user.role] || user.role}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">ID пользователя</p>
              <p className="text-xs font-mono text-foreground">{user.id}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Роль</p>
              <p className="text-sm font-medium text-foreground">{roleLabel[user.role] || "—"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Тема оформления</p>
                <p className="text-sm font-medium text-foreground capitalize">{theme === "dark" ? "Тёмная" : "Светлая"}</p>
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
          </div>
        </div>
      )}

      {user?.role === "admin" && (
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
            { role: "Администратор", tone: "brand", perms: ["Полный доступ ко всем функциям", "Управление учениками и преподавателями", "Запись платежей", "Просмотр финансовых данных", "Расписание уроков", "Настройки Telegram-бота", "Управление ожидающими пользователями"] },
            { role: "Преподаватель", tone: "emerald", perms: ["Просмотр своего расписания", "Отметка уроков как завершённых/отменённых", "Просмотр имён учеников", "Нет доступа к финансовым данным"] },
            { role: "Ученик", tone: "neutral", perms: ["Просмотр предстоящих уроков", "Просмотр календаря уроков", "Просмотр остатка баланса", "Доступ к ссылкам на встречи"] },
            { role: "Ожидающий", tone: "amber", perms: ["Нет доступа к дашбордам", "Только просмотр страницы ожидания", "Доступ откроется после назначения роли администратором"] },
          ].map(({ role, tone, perms }) => (
            <div key={role} className={`rounded-xl border p-4 ${
              tone === "brand" ? "border-brand/20 bg-brand-soft/50 dark:bg-brand-soft/30" :
              tone === "emerald" ? "border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50" :
              tone === "amber" ? "border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50" :
              "border-border bg-muted/50"
            }`}>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full mb-3 inline-block ${
                tone === "brand" ? "bg-brand-muted text-brand" :
                tone === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" :
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
