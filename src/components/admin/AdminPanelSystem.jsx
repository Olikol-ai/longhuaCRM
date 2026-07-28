import { useState } from "react";
import { ShoppingBag, FileText, Send, Settings } from "lucide-react";
import ShopSettingsAdmin from "@/pages/ShopSettingsAdmin";
import WelcomePageEditor from "@/pages/WelcomePageEditor";
import TelegramSettings from "@/pages/TelegramSettings";
import AdminSettings from "@/pages/AdminSettings";

const SYSTEM_TABS = [
  { id: "shop", label: "Магазин", icon: ShoppingBag },
  { id: "welcome", label: "Страница встречи", icon: FileText },
  { id: "telegram", label: "Telegram-бот", icon: Send },
  { id: "integrations", label: "Интеграции", icon: Settings },
];

export default function AdminPanelSystem() {
  const [activeTab, setActiveTab] = useState("shop");

  return (
    <div className="flex flex-col h-full">
      <div className="bg-muted/40 border-b border-border px-4 py-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {SYSTEM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  active
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === "shop" && <ShopSettingsAdmin />}
        {activeTab === "welcome" && <WelcomePageEditor />}
        {activeTab === "telegram" && <TelegramSettings />}
        {activeTab === "integrations" && <AdminSettings />}
      </div>
    </div>
  );
}
