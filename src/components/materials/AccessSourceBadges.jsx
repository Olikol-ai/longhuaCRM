import React from "react";

const SOURCE_STYLES = {
  personal: "bg-brand-soft text-brand border-brand/30 dark:bg-brand-soft/40 dark:text-brand dark:border-brand/40",
  course: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  group: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

/**
 * Expects API access_sources: [{ type, label }]
 */
export default function AccessSourceBadges({ sources, className = "" }) {
  const list = Array.isArray(sources) ? sources : [];
  if (list.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map((src) => {
        const type = src.type || src.source || "personal";
        const label =
          src.label
          || (type === "course"
            ? "Доступ через курс"
            : type === "group"
              ? "Доступ через группу"
              : "Персональный доступ");
        return (
          <span
            key={`${type}-${label}`}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${SOURCE_STYLES[type] || SOURCE_STYLES.personal}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
