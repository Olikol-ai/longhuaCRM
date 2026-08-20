import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/design-system";

export default function DeleteConfirmModal({ title, description, onConfirm, onCancel, loading }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={loading ? undefined : onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="bg-card text-card-foreground rounded-2xl w-full max-w-sm shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span id="delete-confirm-title" className="font-semibold text-sm">{title}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-touch min-w-touch inline-flex items-center justify-center hover:bg-muted rounded-lg"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button intent="outline" onClick={onCancel} disabled={loading}>Отмена</Button>
          <Button intent="danger" onClick={onConfirm} loading={loading}>
            Удалить
          </Button>
        </div>
      </div>
    </div>
  );
}
