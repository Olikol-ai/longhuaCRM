import { useState, useEffect } from "react";
import { api } from '@/api';
import { Send, Save, CheckCircle2, TestTube, Info, Eye, Webhook, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getGreetingName } from "@/lib/display-name";

const fieldCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20";
const fieldMono = `${fieldCls} font-mono`;
const btnOutline = "px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground flex items-center gap-1.5";

function resolveTelegramId(target) {
  if (!target) return '';
  return String(target.telegram_id || target.telegram_chat_id || '').trim();
}

function resolveTelegramUsername(target) {
  if (!target) return '';
  return String(target.telegram_username || '').trim();
}

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
  const [integrationStatus, setIntegrationStatus] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [settings, s, t, status] = await Promise.all([
      api.settings.filter({ key: "telegram_bot_token" }),
      api.students.list(),
      api.teachers.list(),
      api.telegram.status().catch(() => null),
    ]);
    if (settings.length > 0) {
      const v = settings[0].value || "";
      setBotToken(v);
      setSavedMasked(v.length > 5 ? "•".repeat(v.length - 5) + v.slice(-5) : v ? "•".repeat(v.length) : "");
    }
    setStudents(s);
    setTeachers(t);
    setIntegrationStatus(status);
  };

  const saveToken = async () => {
    if (!token.trim()) return;
    setSaving(true);
    const existing = await api.settings.filter({ key: "telegram_bot_token" });
    if (existing.length > 0) {
      await api.settings.update(existing[0].id, { value: token.trim() });
    } else {
      await api.settings.create({ key: "telegram_bot_token", value: token.trim(), description: "Телеграм-бот Token" });
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
    const name = getGreetingName(target);
    const address = name ? `Уважаемый(ая) ${name}` : 'Здравствуйте';
    switch (testTarget.msgType) {
      case "lesson_completed": return `✅ Урок завершён!\n\n${address}${name ? ',' : '!'} ваш урок успешно проведён. Осталось уроков на балансе: ${target?.lesson_balance ?? "N/A"}.`;
      case "lesson_cancelled": return `❌ Урок отменён\n\n${address}${name ? ',' : '!'} ваш урок был отменён. Для записи на новый урок обратитесь к администратору.`;
      case "lesson_reminder": return `⏰ Напоминание об уроке\n\n${address}${name ? ',' : '!'} напоминаем, что у вас скоро занятие по китайскому языку! Не забудьте подключиться вовремя.`;
      case "balance_low": return `⚠️ Низкий баланс\n\n${address}${name ? ',' : '!'} на вашем балансе осталось мало уроков. Рекомендуем пополнить баланс, чтобы не прерывать обучение.`;
      case "payment_received": return `💳 Платёж получен\n\n${address}${name ? ',' : '!'} ваш платёж успешно зачислен. Баланс уроков пополнен.`;
      case "welcome": return name
        ? `🎉 Добро пожаловать в Longhua Academy!\n\nУважаемый(ая) ${name}, рады приветствовать вас! Ваш аккаунт активирован. Желаем успехов в изучении китайского языка!`
        : `🎉 Добро пожаловать в Longhua Academy!\n\nРады приветствовать вас! Ваш аккаунт активирован. Желаем успехов в изучении китайского языка!`;
      default: return testTarget.customMsg || "✅ Тестовое уведомление Longhua Academy успешно отправлено.";
    }
  };

  const sendTest = async () => {
    if (!testTarget.id) {
      setTestResult("error: Выберите получателя");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const message = buildMessage();
    try {
      const data = await api.telegram.sendTest({
        targetType: testTarget.type,
        targetId: testTarget.id,
        message,
      });
      if (data.ok) {
        setTestResult("success");
      } else {
        setTestResult(`error: ${data.error || "Не удалось отправить"}`);
      }
    } catch (e) {
      setTestResult(`error: ${e.message}`);
    }
    setTesting(false);
  };

  const selectedTarget = testTarget.type === "student"
    ? students.find(s => s.id === testTarget.id)
    : teachers.find(t => t.id === testTarget.id);
  const selectedTelegramId = resolveTelegramId(selectedTarget);
  const selectedTelegramUsername = resolveTelegramUsername(selectedTarget);

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
        <div className="w-10 h-10 rounded-xl bg-brand-muted dark:bg-brand-soft/50 flex items-center justify-center">
          <Send className="w-5 h-5 text-brand dark:text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Телеграм-бот</h2>
          <p className="text-sm text-muted-foreground">Настройка уведомлений через Telegram-бот</p>
        </div>
      </div>

      {/* Token */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Токен бота</h3>
        {savedMasked && !showInput ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg font-mono text-sm text-muted-foreground">
              {savedMasked}
            </div>
            <button onClick={() => setShowInput(true)} className={btnOutline}>
              <Eye className="w-3.5 h-3.5" /> Изменить
            </button>
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Сохранено!</span>}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Создайте бота через{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-medium">@BotFather</a>
              {" "}и вставьте полученный токен ниже.
            </p>
            <input type="text" value={token} onChange={e => setToken(e.target.value)}
              placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" className={fieldMono} />
            <div className="flex gap-2">
              <button onClick={saveToken} disabled={saving || !token.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? "Сохранение..." : <><Save className="w-4 h-4" /> Сохранить токен</>}
              </button>
              {showInput && savedMasked && (
                <button onClick={() => { setShowInput(false); setToken(""); }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground">
                  Отмена
                </button>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Вебхук</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Телеграм стучится к нам напрямую — ответ мгновенный</p>
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
          <div className={`rounded-xl px-4 py-3 text-sm ${webhookStatus.ok ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"}`}>
            {webhookStatus.ok ? (
              <div>
                <p className="font-semibold">✅ Вебхук активен!</p>
                <p className="font-mono text-xs mt-1 break-all">{webhookStatus.url}</p>
                <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">Ожидающих обновлений: {webhookStatus.pending}</p>
              </div>
            ) : (
              <p>❌ Ошибка: {webhookStatus.error}</p>
            )}
          </div>
        )}

        <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground">
          Вебхук уже зарегистрирован. Нажмите кнопку только если бот перестал отвечать на <span className="font-mono">/start</span>.
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Статус интеграции</h3>
        {integrationStatus ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <p>Bot: <span className="font-medium text-foreground">{integrationStatus.bot_connected ? 'YES' : 'NO'}</span></p>
            <p>Mode: <span className="font-medium text-foreground">{integrationStatus.mode}</span></p>
            <p>Mock: <span className="font-medium text-foreground">{integrationStatus.mock ? 'YES' : 'NO'}</span></p>
            <p>Polling: <span className="font-medium text-foreground">{integrationStatus.polling?.running ? 'running' : 'stopped'}</span></p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Статус недоступен</p>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Тест уведомлений</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Тип получателя</label>
            <select value={testTarget.type} onChange={e => setTestTarget(p => ({ ...p, type: e.target.value, id: "" }))} className={fieldCls}>
              <option value="student">Ученик</option>
              <option value="teacher">Преподаватель</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Получатель</label>
            <select value={testTarget.id} onChange={e => setTestTarget(p => ({ ...p, id: e.target.value }))} className={fieldCls}>
              <option value="">Выбрать...</option>
              {(testTarget.type === "student" ? students : teachers).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{resolveTelegramId(u) ? "" : " — Telegram не подключен"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Тип сообщения</label>
          <select value={testTarget.msgType} onChange={e => setTestTarget(p => ({ ...p, msgType: e.target.value }))} className={fieldCls}>
            {getMessageTemplates().map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {testTarget.msgType === "custom" && (
          <textarea value={testTarget.customMsg} onChange={e => setTestTarget(p => ({ ...p, customMsg: e.target.value }))}
            placeholder="Введите текст сообщения..." rows={3} className={`${fieldCls} resize-none`} />
        )}

        {testTarget.id && (
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Предпросмотр сообщения:</p>
            <p className="text-xs text-foreground whitespace-pre-line font-mono">{buildMessage()}</p>
            <div className="mt-2 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {selectedTelegramId ? 'Telegram подключен' : 'У пользователя не подключен Telegram'}
              </p>
              {selectedTelegramUsername && selectedTelegramId && (
                <p className="text-muted-foreground">@{selectedTelegramUsername}</p>
              )}
            </div>
          </div>
        )}

        <button onClick={sendTest} disabled={!testTarget.id || testing || !selectedTelegramId}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <TestTube className="w-4 h-4" />
          {testing ? "Отправка..." : "Отправить тест"}
        </button>

        {testTarget.type === "student" && (
          <button
            onClick={async () => {
              if (!testTarget.id) return;
              setTesting(true);
              setTestResult(null);
              try {
                const data = await api.telegram.sendTestConfirmation({
                  studentId: testTarget.id,
                });
                setTestResult(data.ok ? "success" : `error: ${data.error || "Ошибка"}`);
              } catch (e) {
                setTestResult(`error: ${e.message}`);
              }
              setTesting(false);
            }}
            disabled={!testTarget.id || testing || !selectedTelegramId}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Отправить тестовое подтверждение урока
          </button>
        )}

        {testResult && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${testResult === "success" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"}`}>
            {testResult === "success" ? "✅ Сообщение отправлено успешно!" : `❌ ${testResult}`}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Автоматические уведомления</h3>
        <div className="space-y-3">
          {[
            { trigger: "Напоминание (~за 24 часа)", msg: "Информационное сообщение без кнопок", active: true },
            { trigger: "Подтверждение индивидуального занятия (~за 3 часа)", msg: "Текст + кнопки Подтвердить/Отменить; при ответе уведомляется преподаватель", active: true },
            { trigger: "Привязка в профиле", msg: "Глубокая ссылка → /start TOKEN", active: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-foreground">{item.trigger}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">"{item.msg}"</p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                АКТИВНО
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Как подключить уведомления:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
          <li>Ученик или преподаватель открывает профиль в CRM</li>
          <li>Нажимает «Привязать Telegram»</li>
          <li>Открывает бота и подтверждает привязку</li>
        </ol>
      </div>

      <div className="bg-brand-soft dark:bg-brand-soft/30 border border-brand/20 dark:border-brand/40 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-brand dark:text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand dark:text-brand">
          Токен бота доступен только администратору. Уведомления уходят пользователям с привязанным Telegram.
        </p>
      </div>
    </div>
  );
}