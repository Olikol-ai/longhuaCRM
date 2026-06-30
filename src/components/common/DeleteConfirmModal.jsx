import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeleteConfirmModal({ title, description, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl w-full max-w-sm shadow-xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Отмена</Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
