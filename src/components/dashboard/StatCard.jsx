import { Card } from "@/components/ui/card";

const colorMap = {
  brand: { bg: "bg-brand-soft dark:bg-brand-soft/40", icon: "text-brand dark:text-brand", ring: "ring-brand/20 dark:ring-brand/30" },
  /** @deprecated alias — use brand */
  indigo: { bg: "bg-brand-soft dark:bg-brand-soft/40", icon: "text-brand dark:text-brand", ring: "ring-brand/20 dark:ring-brand/30" },
  muted: { bg: "bg-muted", icon: "text-muted-foreground", ring: "ring-border" },
  /** @deprecated alias — use muted */
  violet: { bg: "bg-muted", icon: "text-muted-foreground", ring: "ring-border" },
  /** @deprecated alias — use muted */
  sky: { bg: "bg-muted", icon: "text-muted-foreground", ring: "ring-border" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900/50" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/40", icon: "text-amber-600 dark:text-amber-400", ring: "ring-amber-100 dark:ring-amber-900/50" },
  rose: { bg: "bg-rose-50 dark:bg-rose-950/40", icon: "text-rose-600 dark:text-rose-400", ring: "ring-rose-100 dark:ring-rose-900/50" },
};

export default function StatCard({ label, title, value, icon: Icon, color = "brand", subtitle }) {
  const c = colorMap[color] || colorMap.brand;
  const displayLabel = label ?? title;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{displayLabel}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </Card>
  );
}
