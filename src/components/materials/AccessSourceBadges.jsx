import React from "react";

const SOURCE_STYLES = {
  personal: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  course: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  group: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
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
