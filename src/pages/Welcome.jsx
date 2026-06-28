import React, { useEffect, useState } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import { BookOpen, Clock, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULTS = {
  school_name: "Longhua Chinese",
  title: "Добро пожаловать!",
  subtitle: "Платформа управления языковой школой",
  body_text: "Спасибо, что зарегистрировались в Longhua Chinese!\n\nВаш аккаунт находится на рассмотрении. В ближайшее время администратор назначит вам роль — после этого вы получите доступ к платформе.",
  info_text: "Если у вас есть вопросы — свяжитесь с администратором школы.",
};

export default function Welcome() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    api.entities.WelcomePageSettings.list().then(data => {
      if (data.length > 0) setSettings({ ...DEFAULTS, ...data[0] });
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {settings.school_name}
          </h1>
          <p className="text-slate-500 text-sm">{settings.subtitle}</p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-10 space-y-6">
          <div className="flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="h-10 w-10 text-amber-500" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-800 text-center">
              {user?.full_name ? `Добро пожаловать, ${user.full_name.split(" ")[0]}!` : settings.title}
            </h2>
            {settings.body_text.split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="text-slate-500 leading-relaxed">{line}</p>
            ))}
          </div>

          <div className="bg-indigo-50 rounded-2xl px-6 py-4 flex items-start gap-3 text-left">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-700">{settings.info_text}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3">
          {user && (
            <p className="text-xs text-slate-400">
              Вы вошли как: <span className="font-medium text-slate-600">{user.email}</span>
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => api.auth.logout()}
            className="text-slate-400 hover:text-slate-600 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}