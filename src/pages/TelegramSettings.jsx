import { useState, useEffect } from "react";
import { api } from '@/api';
import { Send, Save, CheckCircle2, TestTube, Info, Eye, Webhook, RefreshCw } from "lucide-react";

export default function TelegramSettings() {
  const [token, setToken] = useState("");
  const [savedMasked, setSavedMasked] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [testTarget, setTestTarget] = useState({ type: "student", id: "", msgType: "custom", customMsg: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [botToken, setBotToken] = useState("");
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [settings, s, t] = await Promise.all([
      api.entities.AppSettings.filter({ key: "telegram_bot_token" }),
      api.entities.Student.list(),
      api.entities.Teacher.list(),
    ]);
    if (settings.length > 0) {
      const v = settings[0].value || "";
      setBotToken(v);
      setSavedMasked(v.length > 5 ? "•".repeat(v.length - 5) + v.slice(-5) : v ? "•".repeat(v.length) : "");
    }
    setStudents(s);
    setTeachers(t);
  };

  const saveToken = async () => {
    if (!token.trim()) return;
    setSaving(true);
    const existing = await api.entities.AppSettings.filter({ key: "telegram_bot_token" });
    if (existing.length > 0) {
      await api.entities.AppSettings.update(existing[0].id, { value: token.trim() });
    } else {
      await api.entities.AppSettings.create({ key: "telegram_bot_token", value: token.trim(), description: "Telegram Bot Token" });
    }
    const v = token.trim();
    setBotToken(v);
    setSavedMasked(v.length > 5 ? "•".repeat(v.length - 5) + v.slice(-5) : "•".repeat(v.length));
    setToken("");
    setShowInput(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getMessageTemplates = () => {
    const list = [
      { id: "custom", label: "Произвольное сообщение" },
      { id: "lesson_completed", label: "Урок завершён" },
      { id: "lesson_cancelled", label: "Урок отменён" },
      { id: "lesson_reminder", label: "Напоминание об уроке" },
      { id: "balance_low", label: "Низкий баланс" },
      { id: "payment_received", label: "Платёж получен" },
      { id: "welcome", label: "Добро пожаловать!" },
    ];
    return list;
  };

  const buildMessage = () => {
    const target = testTarget.type === "student"
      ? students.find(s => s.id === testTarget.id)
      : teachers.find(t => t.id === testTarget.id);
    const name = target?.name || "Пользователь";
    switch (testTarget.msgType) {
      case "lesson_completed": return `✅ Урок завершён!\n\nУважаемый(ая) ${name}, ваш урок успешно проведён. Осталось уроков на балансе: ${target?.lesson_balance ?? "N/A"}.`;
      case "lesson_cancelled": return `❌ Урок отменён\n\nУважаемый(ая) ${name}, ваш урок был отменён. Для записи на новый урок обратитесь к администратору.`;
      case "lesson_reminder": return `⏰ Напоминание об уроке\n\nУважаемый(ая) ${name}, напоминаем, что у вас скоро занятие по китайскому языку! Не забудьте подключиться вовремя.`;
      case "balance_low": return `⚠️ Низкий баланс\n\nУважаемый(ая) ${name}, на вашем балансе осталось мало уроков. Рекомендуем пополнить баланс, чтобы не прерывать обучение.`;
      case "payment_received": return `💳 Платёж получен\n\nУважаемый(ая) ${name}, ваш платёж успешно зачислен. Баланс уроков пополнен.`;
      case "welcome": return `🎉 Добро пожаловать в Longhua Chinese!\n\nУважаемый(ая) ${name}, рады приветствовать вас! Ваш аккаунт активирован. Желаем успехов в изучении китайского языка!`;
      default: return testTarget.customMsg || "Тестовое сообщение от Longhua Chinese";
    }
  };

  const sendTest = async () => {
    const target = testTarget.type === "student"
      ? students.find(s => s.id === testTarget.id)
      : teachers.find(t => t.id === testTarget.id);
    if (!botToken) { setTestResult("error: Токен бота не настроен"); return; }
    if (!target?.telegram_id) { setTestResult("error: У выбранного пользователя нет Telegram ID в профиле"); return; }
    setTesting(true);
    setTestResult(null);
    const message = buildMessage();
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: target.telegram_id, text: message, parse_mode: "HTML" }),
      });
      const data = await res.json();
      setTestResult(data.ok ? "success" : `error: ${data.description}`);
    } catch (e) {
      setTestResult(`error: ${e.message}`);
    }
    setTesting(false);
  };

  const selectedTarget = testTarget.type === "student"
    ? students.find(s => s.id === testTarget.id)
    : teachers.find(t => t.id === testTarget.id);

  const registerWebhook = async () => {
    setWebhookLoading(true);
    setWebhookStatus(null);
    try {
      const res = await api.functions.invoke("fixWebhook", {});
      const data = res.data;
      if (data?.set?.ok) {
        setWebhookStatus({ ok: true, url: data.webhook?.url, pending: data.webhook?.pending_update_count });
      } else {
        setWebhookStatus({ ok: false, error: data?.set?.description || "Неизвестная ошибка" });
      }
    } catch (e) {
      setWebhookStatus({ ok: false, error: e.message });
    }
    setWebhookLoading(false);
  };



  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Send className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Telegram Bot</h2>
          <p className="text-sm text-slate-400">Настройка уведомлений через @LonghuaChinese_bot</p>
        </div>
      </div>

      {/* Token */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Токен бота</h3>
        {savedMasked && !showInput ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-600">
              {savedMasked}
            </div>
            <button onClick={() => setShowInput(true)}
              className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Изменить
            </button>
            {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Сохранено!</span>}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Создайте бота через{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline font-medium">@BotFather</a>
              {" "}и вставьте полученный токен ниже.
            </p>
            <input type="text" value={token} onChange={e => setToken(e.target.value)}
              placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            <div className="flex gap-2">
              <button onClick={saveToken} disabled={saving || !token.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? "Сохранение..." : <><Save className="w-4 h-4" /> Сохранить токен</>}
              </button>
              {showInput && savedMasked && (
                <button onClick={() => { setShowInput(false); setToken(""); }}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                  Отмена
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Webhook */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Webhook (вебхук)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Telegram стучится к нам напрямую — ответ мгновенный</p>
          </div>
          <button
            onClick={registerWebhook}
            disabled={webhookLoading || !botToken}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
            {webhookLoading ? "Регистрирую..." : "Зарегистрировать"}
          </button>
        </div>

        {webhookStatus && (
          <div className={`rounded-xl px-4 py-3 text-sm ${webhookStatus.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {webhookStatus.ok ? (
              <div>
                <p className="font-semibold">✅ Вебхук активен!</p>
                <p className="font-mono text-xs mt-1 break-all">{webhookStatus.url}</p>
                <p className="text-xs mt-1 text-emerald-600">Ожидающих обновлений: {webhookStatus.pending}</p>
              </div>
            ) : (
              <p>❌ Ошибка: {webhookStatus.error}</p>
            )}
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
          Вебхук уже зарегистрирован. Нажмите кнопку только если бот перестал отвечать на <span className="font-mono">/start</span>.
        </div>
      </div>

      {/* Test messages */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Тест уведомлений</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Тип получателя</label>
            <select value={testTarget.type} onChange={e => setTestTarget(p => ({ ...p, type: e.target.value, id: "" }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="student">Ученик</option>
              <option value="teacher">Преподаватель</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Получатель</label>
            <select value={testTarget.id} onChange={e => setTestTarget(p => ({ ...p, id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">Выбрать...</option>
              {(testTarget.type === "student" ? students : teachers).map(u => (
                <option key={u.id} value={u.id}>{u.name}{u.telegram_id ? "" : " ⚠️ нет TG ID"}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Тип сообщения</label>
          <select value={testTarget.msgType} onChange={e => setTestTarget(p => ({ ...p, msgType: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            {getMessageTemplates().map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {testTarget.msgType === "custom" && (
          <textarea value={testTarget.customMsg} onChange={e => setTestTarget(p => ({ ...p, customMsg: e.target.value }))}
            placeholder="Введите текст сообщения..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        )}

        {testTarget.id && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-medium text-slate-500 mb-1">Предпросмотр сообщения:</p>
            <p className="text-xs text-slate-700 whitespace-pre-line font-mono">{buildMessage()}</p>
            {!selectedTarget?.telegram_id && (
              <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ У этого пользователя не указан Telegram ID в профиле</p>
            )}
          </div>
        )}

        <button onClick={sendTest} disabled={!testTarget.id || testing || !botToken}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <TestTube className="w-4 h-4" />
          {testing ? "Отправка..." : "Отправить тест"}
        </button>

        {testResult && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${testResult === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {testResult === "success" ? "✅ Сообщение отправлено успешно!" : `❌ ${testResult}`}
          </div>
        )}
      </div>

      {/* Auto notifications */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Автоматические уведомления</h3>
        <div className="space-y-3">
          {[
            { trigger: "Урок завершён (преподаватель отметил)", msg: "✅ Урок завершён. Осталось уроков: X", active: true },
            { trigger: "Пропуск без предупреждения", msg: "⚠️ Урок пропущен. Баланс списан.", active: true },
            { trigger: "Напоминание за день до урока", msg: "⏰ Завтра урок в HH:MM. Ссылка: ...", active: true },
            { trigger: "/start в боте", msg: "🎉 Спасибо за подключение уведомлений!", active: true },
            { trigger: "Подключение Telegram в профиле", msg: "🎉 Уведомления активированы!", active: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700">{item.trigger}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">"{item.msg}"</p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                АКТИВНО
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-800">⚙️ Как ученики подключают уведомления:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
          <li>Открывают бота <span className="font-semibold">@LonghuaChinese_bot</span> в Telegram</li>
          <li>Нажимают <span className="font-mono bg-slate-100 px-1 rounded">/start</span> — бот автоматически ответит ✅</li>
          <li>Копируют свой Telegram ID и вводят его в профиле на сайте</li>
        </ol>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Токен сохраняется в базе данных приложения и доступен только администратору. Для работы уведомлений ученики и преподаватели должны указать свой Telegram ID в профиле.
        </p>
      </div>
    </div>
  );
}