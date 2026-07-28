import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  Download,
  Settings2,
  BookOpen,
} from "lucide-react";
import Analytics from "./Analytics";
import Salary from "./Salary";
import ExportData from "./ExportData";
import AdminPanelSystem from "@/components/admin/AdminPanelSystem";
import AdminTutors from "./AdminTutors";

const TABS = [
  { id: "analytics", label: "Аналитика", icon: TrendingUp },
  { id: "tutors", label: "Репетиторы", icon: BookOpen },
  { id: "salary", label: "Зарплата", icon: DollarSign },
  { id: "export", label: "Экспорт", icon: Download },
  { id: "system", label: "Система", icon: Settings2 },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

export default function AdminPanel() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTab && TAB_IDS.has(initialTab) ? initialTab : "analytics",
  );

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      <div className="bg-card border-b border-border px-3 lg:px-6 overflow-x-auto scrollbar-thin">
        <div className="flex gap-0.5 py-1 min-w-max lg:gap-1 lg:py-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-lg whitespace-nowrap transition-colors shrink-0 lg:px-3 lg:py-1.5 lg:text-sm ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 lg:w-4 lg:h-4 ${active ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "tutors" && <AdminTutors />}
        {activeTab === "salary" && <Salary />}
        {activeTab === "export" && <ExportData />}
        {activeTab === "system" && <AdminPanelSystem />}
      </div>
    </div>
  );
}
