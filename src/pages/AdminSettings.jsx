import { useState, useEffect } from "react";
import { api } from '@/api';
import { Settings, CreditCard, Save, CheckCircle2, Eye, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

const fieldCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";
const btnOutline = "px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground flex items-center gap-1.5";

export default function AdminSettings() {
  const [alfaToken, setAlfaToken] = useState("");
  const [alfaMasked, setAlfaMasked] = useState("");
  const [showAlfaInput, setShowAlfaInput] = useState(false);
  const [savingAlfa, setSavingAlfa] = useState(false);
  const [savedAlfa, setSavedAlfa] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const settings = await api.settings.filter({ key: "alfa_bank_token" });
    if (settings.length > 0) {
      const v = settings[0].value || "";
      setAlfaMasked(v.length > 5 ? "•".repeat(v.length - 5) + v.slice(-5) : v ? "•".repeat(v.length) : "");
    }
  };

  const saveAlfaToken = async () => {
    if (!alfaToken.trim()) return;
    setSavingAlfa(true);
    const existing = await api.settings.filter({ key: "alfa_bank_token" });
    if (existing.length > 0) {
      await api.settings.update(existing[0].id, {
        key: 'alfa_bank_token',
        value: alfaToken.trim(),
      });
    } else {
      await api.settings.create({ key: "alfa_bank_token", value: alfaToken.trim(), description: "Alfa Bank Acquiring Token (Belarus)" });
    }
    const v = alfaToken.trim();
    setAlfaMasked(v.length > 5 ? "•".repeat(v.length - 5) + v.slice(-5) : "•".repeat(v.length));
    setAlfaToken("");
    setShowAlfaInput(false);
    setSavingAlfa(false);
    setSavedAlfa(true);
    setTimeout(() => setSavedAlfa(false), 3000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Настройки интеграций</h2>
          <p className="text-sm text-muted-foreground">Токены и ключи доступны только администратору</p>
        </div>
      </div>

      {/* Alfa Bank */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-foreground">Интернет-эквайринг Альфа-Банк (Беларусь)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Вставьте токен/ключ от личного кабинета интернет-эквайринга Альфа-Банка Беларусь. Токен используется для приёма онлайн-платежей от учеников.
        </p>

        {alfaMasked && !showAlfaInput ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg font-mono text-sm text-muted-foreground">
              {alfaMasked}
            </div>
            <button onClick={() => setShowAlfaInput(true)} className={btnOutline}>
              <Eye className="w-3.5 h-3.5" /> Изменить
            </button>
            {savedAlfa && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Сохранено!</span>}
          </div>
        ) : (
          <>
            <input type="text" value={alfaToken} onChange={e => setAlfaToken(e.target.value)}
              placeholder="Вставьте токен Альфа-Банка..." className={fieldCls} />
            <div className="flex gap-2">
              <button onClick={saveAlfaToken} disabled={savingAlfa || !alfaToken.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {savingAlfa ? "Сохранение..." : <><Save className="w-4 h-4" /> Сохранить токен</>}
              </button>
              {showAlfaInput && alfaMasked && (
                <button onClick={() => { setShowAlfaInput(false); setAlfaToken(""); }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground">
                  Отмена
                </button>
              )}
            </div>
          </>
        )}

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Как получить токен:</strong> Войдите в личный кабинет Альфа-Банка Беларусь → раздел «Интернет-эквайринг» → API ключи. Скопируйте секретный ключ и вставьте сюда.
          </p>
        </div>
      </Card>

      <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-700 dark:text-red-300">
          Все токены и ключи хранятся в защищённой базе данных приложения. Доступ к ним имеет только администратор.
        </p>
      </div>
    </div>
  );
}