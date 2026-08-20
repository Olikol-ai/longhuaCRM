import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { X, Package, GraduationCap, Check, CreditCard, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBYN } from "@/lib/formatters";
import { userFacingError } from "@/lib/userFacingError";

const STEPS = { SELECT: "select", CONFIRM: "confirm", PAYMENT: "payment", DONE: "done" };

function shopItemLabel(item) {
  return item?.name || item?.label || "Позиция";
}

function shopItemLessons(item) {
  return Number(item?.lessons_count ?? item?.lessons ?? 0);
}

export default function TopUpModal({ onClose }) {
  const { user, isLoadingAuth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("package");
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(STEPS.SELECT);
  const [student, setStudent] = useState(null);
  const [paying, setPaying] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState('');
  const [offlineError, setOfflineError] = useState('');

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.students.filter({ user_id: user.id }),
      api.payments.shopItems.list("sort_order"),
    ]).then(([students, data]) => {
      setStudent(students[0]);
      setItems(data.filter((i) => i.is_active));
      setLoading(false);
    });
  }, [user, isLoadingAuth]);

  const filtered = items.filter((i) => i.type === tab);

  const handleSelect = (item) => {
    setSelected(item);
    setStep(STEPS.CONFIRM);
  };

  const handleConfirm = () => setStep(STEPS.PAYMENT);

  const handleCardPayment = async () => {
    if (!selected || !student) return;

    setPaying(true);
    setOfflineNotice('');
    setOfflineError('');
    try {
      // Backend sets returnUrl to /PaymentReturn?payment_id=... after creating the payment row.
      const result = await api.alfabank.initCardPayment({
        type: selected.type,
        item_id: selected.id,
        student_id: student.id,
        return_url: `${window.location.origin}/PaymentReturn`,
      });

      const paymentId = result.payment_id;
      const redirectUrl = result.redirect_url;
      if (!redirectUrl || !paymentId) {
        throw new Error('Банк не вернул ссылку на оплату');
      }

      try {
        sessionStorage.setItem('alfa_last_payment_id', paymentId);
      } catch {
        /* ignore */
      }

      window.location.href = redirectUrl;
    } catch (err) {
      setOfflineError(
        userFacingError(
          err,
          'Не удалось начать оплату картой. Попробуйте ЕРИП/наличные или свяжитесь со школой.',
        ),
      );
      setPaying(false);
    }
  };

  const handleOfflinePayment = async (method) => {
    if (!selected || !student) return;

    setPaying(true);
    setOfflineNotice('');
    setOfflineError('');
    try {
      const result = await api.alfabank.requestOfflinePayment({
        student_id: student.id,
        item_label: shopItemLabel(selected),
        amount: selected.price,
        method,
        item_id: selected.id,
      });
      setStep(STEPS.DONE);
      if (result.warning) {
        setOfflineNotice(result.warning);
      } else {
        setOfflineNotice(
          'Заявка отправлена администратору. Мы свяжемся с вами для подтверждения оплаты.',
        );
      }
    } catch (err) {
      setOfflineError(
        userFacingError(
          err,
          'Не удалось отправить заявку. Попробуйте позже или свяжитесь с администратором.',
        ),
      );
    } finally {
      setPaying(false);
    }
  };

  const handlePayment = async (method) => {
    if (method === 'card') {
      await handleCardPayment();
      return;
    }
    await handleOfflinePayment(method);
  };

  const handleDone = () => onClose();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl overflow-hidden safe-pb sm:pb-0">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {step === STEPS.SELECT && "Пополнить баланс"}
              {step === STEPS.CONFIRM && "Подтверждение"}
              {step === STEPS.PAYMENT && "Оплата"}
              {step === STEPS.DONE && "Готово"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === STEPS.SELECT && "Выберите абонемент или курс"}
              {step === STEPS.CONFIRM && "Проверьте выбранное"}
              {step === STEPS.PAYMENT && "Способ оплаты"}
              {step === STEPS.DONE && "Заявка отправлена"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          {step === STEPS.SELECT && (
            <div className="space-y-4">
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                {[["package", Package, "Абонементы"], ["course", GraduationCap, "Курсы"]].map(([t, Icon, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Нет доступных предложений</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((item) => {
                    const lessons = shopItemLessons(item);
                    return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left p-4 rounded-2xl border border-border hover:border-brand/40 dark:hover:border-brand/40 hover:bg-brand-soft/50 dark:hover:bg-brand-soft/20 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{shopItemLabel(item)}</span>
                            {item.note && (
                              <span className="text-[11px] bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                                {item.note}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {lessons} {lessons === 1 ? "урок" : lessons < 5 ? "урока" : "уроков"}
                            {item.description ? ` · ${item.description}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {item.price > 0 ? (
                            <span className="text-sm font-bold text-foreground">{formatBYN(item.price)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">по договору</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === STEPS.CONFIRM && selected && (
            <div className="space-y-5">
              <div className="bg-brand-soft dark:bg-brand-soft/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center">
                    {selected.type === "course" ? (
                      <GraduationCap className="h-5 w-5 text-white" />
                    ) : (
                      <Package className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{shopItemLabel(selected)}</p>
                    <p className="text-xs text-muted-foreground">
                      {shopItemLessons(selected)} {shopItemLessons(selected) === 1 ? "урок" : shopItemLessons(selected) < 5 ? "урока" : "уроков"}
                    </p>
                  </div>
                </div>
                {selected.price > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-brand/20 dark:border-brand/40">
                    <span className="text-sm text-muted-foreground">Итого к оплате:</span>
                    <span className="text-xl font-bold text-brand">{formatBYN(selected.price)}</span>
                  </div>
                )}
                {selected.description && (
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(STEPS.SELECT)} className="flex-1">
                  Назад
                </Button>
                <Button onClick={handleConfirm} className="flex-1 bg-primary hover:bg-primary/90">
                  Перейти к оплате
                </Button>
              </div>
            </div>
          )}

          {step === STEPS.PAYMENT && selected && (
            <div className="space-y-5">
              {offlineError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{offlineError}</p>
              )}
              <p className="text-sm text-muted-foreground">Выберите способ оплаты:</p>
              <div className="space-y-2">
                {[
                  { id: "card", label: "Оплатить картой", hint: "Банковская карта через AlfaBank" },
                  { id: "erip", label: "Оставить заявку · ЕРИП", hint: "Через интернет-банк" },
                  { id: "cash", label: "Оставить заявку · Наличные", hint: "В офисе школы" },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handlePayment(method.id)}
                    disabled={paying}
                    className="w-full text-left p-4 rounded-2xl border border-border hover:border-brand/40 dark:hover:border-brand/40 hover:bg-brand-soft/50 dark:hover:bg-brand-soft/20 transition-all group flex items-center gap-3 disabled:opacity-50"
                  >
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center group-hover:bg-brand-muted dark:group-hover:bg-brand-soft/40">
                      {paying ? (
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-brand" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.hint}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand" />
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setStep(STEPS.CONFIRM)} className="w-full" disabled={paying}>
                Назад
              </Button>
            </div>
          )}

          {step === STEPS.DONE && (
            <div className="text-center space-y-5 py-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Заявка отправлена!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {offlineNotice || 'Администратор обработает ваш запрос и пополнит баланс в ближайшее время.'}
                </p>
              </div>
              <Button onClick={handleDone} className="w-full bg-primary hover:bg-primary/90">
                Готово
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
