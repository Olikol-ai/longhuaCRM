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
    admin: "bg-violet-100 text-violet-700",
    teacher: "bg-emerald-100 text-emerald-700",
    student: "bg-sky-100 text-sky-700",
    pending: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Настройки</h2>
        <p className="text-sm text-slate-400 dark:text-slate-400">Управление аккаунтом</p>
      </div>



      {user && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{(user.full_name || user.email || "U")[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">{user.full_name || "—"}</h3>
              <p className="text-sm text-slate-400 dark:text-slate-300">{user.email}</p>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${roleColor[user.role] || roleColor.pending}`}>
                {roleLabel[user.role] || user.role}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5">ID пользователя</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{user.id}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5">Роль</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{roleLabel[user.role] || "—"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5">Тема оформления</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{theme === "dark" ? "Тёмная" : "Светлая"}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors"
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 mt-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Экспорт данных</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Скачайте полный архив всех данных системы</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 mt-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Права доступа по ролям</h3>
          {[
            { role: "Администратор", color: "violet", perms: ["Полный доступ ко всем функциям", "Управление учениками и преподавателями", "Запись платежей", "Просмотр финансовых данных", "Расписание уроков", "Настройки Telegram-бота", "Управление ожидающими пользователями"] },
            { role: "Преподаватель", color: "emerald", perms: ["Просмотр своего расписания", "Отметка уроков как завершённых/отменённых", "Просмотр имён учеников", "Нет доступа к финансовым данным"] },
            { role: "Ученик", color: "sky", perms: ["Просмотр предстоящих уроков", "Просмотр календаря уроков", "Просмотр остатка баланса", "Доступ к ссылкам на встречи"] },
            { role: "Ожидающий", color: "amber", perms: ["Нет доступа к дашбордам", "Только просмотр страницы ожидания", "Доступ откроется после назначения роли администратором"] },
          ].map(({ role, color, perms }) => (
            <div key={role} className={`rounded-xl border p-4 ${
              color === "violet" ? "border-violet-100 bg-violet-50/50" :
              color === "emerald" ? "border-emerald-100 bg-emerald-50/50" :
              color === "amber" ? "border-amber-100 bg-amber-50/50" :
              "border-sky-100 bg-sky-50/50"
            }`}>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full mb-3 inline-block ${
                color === "violet" ? "bg-violet-100 text-violet-700" :
                color === "emerald" ? "bg-emerald-100 text-emerald-700" :
                color === "amber" ? "bg-amber-100 text-amber-700" :
                "bg-sky-100 text-sky-700"
              }`}>{role}</span>
              <ul className="space-y-1">
                {perms.map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" /> {p}
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