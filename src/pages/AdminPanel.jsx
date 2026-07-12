import { useState } from "react";
import { CreditCard, TrendingUp, DollarSign, Download, ShoppingBag, FileText, Settings, Send, Users, Award, ClipboardCheck, CalendarRange } from "lucide-react";

// Import content from existing pages (inline as tabs)
import Payments from "./Payments";
import Analytics from "./Analytics";
import Salary from "./Salary";
import ExportData from "./ExportData";
import ShopSettingsAdmin from "./ShopSettingsAdmin";
import WelcomePageEditor from "./WelcomePageEditor";
import AdminSettings from "./AdminSettings";
import TelegramSettings from "./TelegramSettings";
import Groups from "./Groups";
import Certificates from "./Certificates";
import Attendance from "./Attendance";
import TeacherPayments from "./TeacherPayments";
import LessonSeriesAdmin from "./LessonSeriesAdmin";

const TABS = [
  { id: "payments",   label: "Платежи",            icon: CreditCard },
  { id: "analytics",  label: "Аналитика",           icon: TrendingUp },
  { id: "salary",     label: "Зарплата",            icon: DollarSign },
  { id: "teacherPayments", label: "Выплаты",        icon: DollarSign },
  { id: "groups",     label: "Группы",              icon: Users },
  { id: "certificates", label: "Сертификаты",       icon: Award },
  { id: "attendance", label: "Посещаемость",        icon: ClipboardCheck },
  { id: "lessonSeries", label: "Серии уроков",      icon: CalendarRange },
  { id: "export",     label: "Экспорт",             icon: Download },
  { id: "shop",       label: "Магазин",             icon: ShoppingBag },
  { id: "welcome",    label: "Страница встречи",    icon: FileText },
  { id: "telegram",   label: "Telegram Bot",        icon: Send },
  { id: "integrations", label: "Интеграции",        icon: Settings },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("payments");

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 lg:px-8 overflow-x-auto">
        <div className="flex gap-1 py-2 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  active
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "payments"      && <Payments />}
        {activeTab === "analytics"     && <Analytics />}
        {activeTab === "salary"        && <Salary />}
        {activeTab === "teacherPayments" && <TeacherPayments />}
        {activeTab === "groups"        && <Groups />}
        {activeTab === "certificates"  && <Certificates />}
        {activeTab === "attendance"    && <Attendance />}
        {activeTab === "lessonSeries"  && <LessonSeriesAdmin />}
        {activeTab === "export"        && <ExportData />}
        {activeTab === "shop"          && <ShopSettingsAdmin />}
        {activeTab === "welcome"       && <WelcomePageEditor />}
        {activeTab === "telegram"      && <TelegramSettings />}
        {activeTab === "integrations"  && <AdminSettings />}
      </div>
    </div>
  );
}