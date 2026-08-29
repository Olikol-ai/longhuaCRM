import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { api } from '@/api';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

/**
 * Manage who has access to a homework template (owner only).
 */
export default function HomeworkAccessManageDialog({
  open,
  onOpenChange,
  homeworkId,
  homeworkTitle,
  onChanged,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const list = await api.homework.listAccess(homeworkId);
      setRows(Array.isArray(list) ? list : []);
      setSelectedIds([]);
    } catch (err) {
      setRows([]);
      toast({
        title: 'Не удалось загрузить доступы',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && homeworkId) void load();
    if (!open) {
      setRows([]);
      setSelectedIds([]);
    }
  }, [open, homeworkId]);

  const toggle = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );
  };

  const revoke = async (granteeUserIds) => {
    if (!homeworkId || !granteeUserIds.length) return;
    setRevoking(true);
    try {
      await api.homework.bulkRevoke({
        homework_ids: [homeworkId],
        grantee_user_ids: granteeUserIds,
      });
      toast({ title: 'Доступ отозван' });
      await load();
      onChanged?.();
    } catch (err) {
      toast({
        title: 'Не удалось отозвать доступ',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="homework-access-manage-dialog"
      >
        <DialogHeader>
          <DialogTitle>Управление доступом</DialogTitle>
          <DialogDescription>
            Кто может видеть шаблон
            {homeworkTitle ? ` «${homeworkTitle}»` : ''} и назначать его ученикам.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Пока никому не предоставлен доступ
            </p>
          ) : (
            rows.map((row) => (
              <label
                key={row.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedIds.includes(row.grantee_user_id)}
                  onChange={() => toggle(row.grantee_user_id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium block truncate">
                    {row.grantee_name || row.grantee_email || row.grantee_user_id}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate">
                    {row.grantee_email || ''}
                    {row.grantee_role ? ` · ${row.grantee_role}` : ''}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revoking}
                  onClick={(e) => {
                    e.preventDefault();
                    void revoke([row.grantee_user_id]);
                  }}
                  data-testid={`homework-revoke-${row.grantee_user_id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Отозвать
                </Button>
              </label>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={revoking}>
            Закрыть
          </Button>
          <Button
            intent="danger"
            disabled={revoking || selectedIds.length === 0}
            onClick={() => revoke(selectedIds)}
            data-testid="homework-bulk-revoke"
          >
            {revoking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Отозвать выбранных (${selectedIds.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
