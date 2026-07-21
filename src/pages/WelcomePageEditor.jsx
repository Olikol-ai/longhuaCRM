import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Loader2, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const DEFAULTS = {
  school_name: "Longhua Academy",
  title: "Добро пожаловать!",
  subtitle: "Образовательная платформа Longhua Academy",
  body_text: "Спасибо, что зарегистрировались в Longhua Academy!\n\nВаш аккаунт находится на рассмотрении. В ближайшее время администратор назначит вам роль — после этого вы получите доступ к платформе.",
  info_text: "Если у вас есть вопросы — свяжитесь с администратором Longhua Academy.",
};

export default function WelcomePageEditor() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const data = await api.settings.welcome.list();
    if (data.length > 0) {
      setRecord(data[0]);
      setForm({ ...DEFAULTS, ...data[0] });
    }
    setLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (record) {
      await api.settings.welcome.update(record.id, form);
    } else {
      const created = await api.settings.welcome.create(form);
      setRecord(created);
    }
    setSaving(false);
    toast({ title: "Сохранено", description: "Страница приветствия обновлена." });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Страница приветствия</h1>
          <p className="text-sm text-muted-foreground mt-1">Редактирование текста, который видят новые пользователи</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      <Card className="p-6 space-y-5">
        <Field label="Название школы" value={form.school_name} onChange={v => set("school_name", v)} />
        <Field label="Заголовок" value={form.title} onChange={v => set("title", v)} />
        <Field label="Подзаголовок" value={form.subtitle} onChange={v => set("subtitle", v)} />
        <Field label="Основной текст" value={form.body_text} onChange={v => set("body_text", v)} multiline />
        <Field label="Текст информационного блока (синий)" value={form.info_text} onChange={v => set("info_text", v)} multiline />
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">Предпросмотр</p>
        </div>
        <div className="bg-gradient-to-br from-brand-soft via-background to-muted dark:from-brand-soft/30 dark:via-background dark:to-muted rounded-2xl border border-border p-8 text-center space-y-5">
          <p className="text-xl font-bold text-foreground">{form.school_name}</p>
          <p className="text-muted-foreground text-xs">{form.subtitle}</p>
          <Card className="p-6 space-y-4 text-left max-w-sm mx-auto">
            <h2 className="text-lg font-bold text-foreground text-center">{form.title}</h2>
            {form.body_text.split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="text-muted-foreground text-sm">{line}</p>
            ))}
            <div className="bg-brand-soft dark:bg-brand-soft/40 rounded-xl px-4 py-3 text-sm text-brand dark:text-brand">
              {form.info_text}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  const cls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40";
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${cls} resize-none`} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}