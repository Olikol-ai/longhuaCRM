import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const trendToneClass = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  muted: "text-muted-foreground",
};

/**
 * @param {{
 *   label?: string,
 *   title?: string,
 *   value: React.ReactNode,
 *   icon: React.ComponentType<{ className?: string }>,
 *   color?: keyof typeof colorMap,
 *   subtitle?: React.ReactNode,
 *   previousLine?: string,
 *   trendLine?: string,
 *   trendTone?: 'up' | 'down' | 'muted',
 * }} props
 */
export default function StatCard({
  label,
  title,
  value,
  icon: Icon,
  color = "brand",
  subtitle,
  previousLine,
  trendLine,
  trendTone = "muted",
}) {
  const c = colorMap[color] || colorMap.brand;
  const displayLabel = label ?? title;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground leading-snug">{displayLabel}</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
          {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
          {previousLine ? (
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{previousLine}</p>
          ) : null}
          {trendLine ? (
            <p
              className={cn(
                "text-xs font-medium mt-0.5 leading-snug",
                trendToneClass[trendTone] || trendToneClass.muted,
              )}
            >
              {trendLine}
            </p>
          ) : null}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </Card>
  );
}
