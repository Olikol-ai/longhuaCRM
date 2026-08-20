import React, { useEffect, useState } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import { formatWelcomeGreeting, getGreetingName } from "@/lib/display-name";
import { BookOpen, Clock, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/design-system";

const DEFAULTS = {
  school_name: "Longhua Academy",
  title: "Добро пожаловать!",
  subtitle: "Образовательная платформа Longhua Academy",
  body_text: "Спасибо, что зарегистрировались в Longhua Academy!\n\nВаш аккаунт находится на рассмотрении. В ближайшее время администратор назначит вам роль — после этого вы получите доступ к платформе.",
  info_text: "Если у вас есть вопросы — свяжитесь с администратором Longhua Academy.",
};

export default function Welcome() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    api.settings.welcome.list().then(data => {
      if (data.length > 0) setSettings({ ...DEFAULTS, ...data[0] });
    }).catch(() => {});
  }, []);

  const greetingName = getGreetingName(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-soft dark:from-brand-soft/40 via-background to-muted flex items-center justify-center page-pad safe-pb">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="flex items-center justify-center gap-3">
          <div className="h-14 w-14 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-amber-300/50">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {settings.school_name}
          </h1>
          <p className="text-muted-foreground text-sm">{settings.subtitle}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 sm:p-10 space-y-6">
          <div className="flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Clock className="h-10 w-10 text-amber-500" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground text-center">
              {greetingName ? formatWelcomeGreeting(user) : settings.title}
            </h2>
            {settings.body_text.split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>

          <div className="bg-brand-soft dark:bg-brand-soft/40 rounded-2xl px-6 py-4 flex items-start gap-3 text-left">
            <Sparkles className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <p className="text-sm text-brand">{settings.info_text}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          {user && (
            <p className="text-xs text-muted-foreground">
              Вы вошли как: <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}
          <Button
            intent="ghost"
            size="sm"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}
