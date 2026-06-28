import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { X, Package, GraduationCap, Check, CreditCard, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = { SELECT: "select", CONFIRM: "confirm", PAYMENT: "payment", DONE: "done" };

export default function TopUpModal({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("package");
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(STEPS.SELECT);
  const [student, setStudent] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([
      api.auth.me(),
      api.entities.ShopSettings.list("sort_order"),
    ]).then(([user, data]) => {
      api.entities.Student.filter({ user_id: user.id }).then((students) => {
        setStudent(students[0]);
        setItems(data.filter((i) => i.is_active));
        setLoading(false);
      });
    });
  }, []);

  const filtered = items.filter((i) => i.type === tab);

  const handleSelect = (item) => {
    setSelected(item);
    setStep(STEPS.CONFIRM);
  };

  const handleConfirm = () => setStep(STEPS.PAYMENT);

  const handlePayment = async (method) => {
    if (!selected || !student) return;
    
    if (method === "card") {
      // Интеграция с Alfa Bank
      setPaying(true);
      try {
        const res = await api.functions.invoke("alfaBankInit", {
          type: selected.type,
          itemId: selected.item_id,
          studentId: student.id,
          amount: selected.price,
          returnUrl: window.location.href,
        });
        
        if (res.data.redirectUrl) {
          // Редирект на платёжную форму Alfa Bank
          window.location.href = res.data.redirectUrl;
        } else {
          console.error("No redirect URL");
          setPaying(false);
        }
      } catch (err) {
        console.error("Payment init error:", err);
        setPaying(false);
      }
    } else {
      // Другие методы - уведомление администратору
      setStep(STEPS.DONE);
      if (student.telegram_id) {
        api.functions.invoke("sendTelegramMessage", {
          chat_id: student.telegram_id,
          text: `📋 Заявка на пополнение баланса\n\n${selected.label}\n💳 Сумма: ${selected.price} BYN\n💬 Способ: ${method === "erip" ? "ЕРИП" : "Наличные в офисе"}\n\nАдминистратор свяжется с вами в ближайшее время.`,
        }).catch(() => {});
      }
      setPaying(false);
    }
  };

  const handleDone = () => onClose();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {step === STEPS.SELECT && "Пополнить баланс"}
              {step === STEPS.CONFIRM && "Подтверждение"}
              {step === STEPS.PAYMENT && "Оплата"}
              {step === STEPS.DONE && "Готово"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === STEPS.SELECT && "Выберите абонемент или курс"}
              {step === STEPS.CONFIRM && "Проверьте выбранное"}
              {step === STEPS.PAYMENT && "Способ оплаты"}
              {step === STEPS.DONE && "Заявка отправлена"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Select */}
          {step === STEPS.SELECT && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {[["package", Package, "Абонементы"], ["course", GraduationCap, "Курсы"]].map(([t, Icon, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Нет доступных предложений</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 text-sm">{item.label}</span>
                            {item.note && (
                              <span className="text-[11px] bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                                {item.note}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.lessons} {item.lessons === 1 ? "урок" : item.lessons < 5 ? "урока" : "уроков"}
                            {item.description ? ` · ${item.description}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {item.price > 0 ? (
                            <span className="text-sm font-bold text-slate-900">{item.price} BYN</span>
                          ) : (
                            <span className="text-xs text-slate-400">по договору</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm */}
          {step === STEPS.CONFIRM && selected && (
            <div className="space-y-5">
              <div className="bg-indigo-50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                    {selected.type === "course" ? (
                      <GraduationCap className="h-5 w-5 text-white" />
                    ) : (
                      <Package className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{selected.label}</p>
                    <p className="text-xs text-slate-500">
                      {selected.lessons} {selected.lessons === 1 ? "урок" : selected.lessons < 5 ? "урока" : "уроков"}
                    </p>
                  </div>
                </div>
                {selected.price > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                    <span className="text-sm text-slate-600">Итого к оплате:</span>
                    <span className="text-xl font-bold text-indigo-700">{selected.price} BYN</span>
                  </div>
                )}
                {selected.description && (
                  <p className="text-xs text-slate-500">{selected.description}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(STEPS.SELECT)} className="flex-1">
                  Назад
                </Button>
                <Button onClick={handleConfirm} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  Перейти к оплате
                </Button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {step === STEPS.PAYMENT && selected && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">Выберите способ оплаты:</p>
              <div className="space-y-2">
                {[
                  { id: "card", label: "Банковская карта", hint: "Visa / Mastercard / МИР" },
                  { id: "erip", label: "ЕРИП", hint: "Через интернет-банк" },
                  { id: "cash", label: "Наличные", hint: "В офисе школы" },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handlePayment(method.id)}
                    disabled={paying}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group flex items-center gap-3 disabled:opacity-50"
                  >
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100">
                      {paying ? (
                        <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{method.label}</p>
                      <p className="text-xs text-slate-400">{method.hint}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setStep(STEPS.CONFIRM)} className="w-full" disabled={paying}>
                Назад
              </Button>
            </div>
          )}

          {/* Step: Done */}
          {step === STEPS.DONE && (
            <div className="text-center space-y-5 py-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Заявка отправлена!</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Администратор обработает ваш запрос и пополнит баланс в ближайшее время.
                </p>
              </div>
              <Button onClick={handleDone} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Готово
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}