import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Native &lt;select&gt; for school teacher assignment.
 *
 * Same data source as UserManagement teacher filter / Groups create form:
 *   api.teachers.list() → TeacherEntity.id + name
 *
 * Intentionally NOT Radix Select — native dropdown works inside Dialog/Sheet.
 */
const fieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function teacherOptionLabel(teacher) {
  if (!teacher) return '';
  return String(teacher.name || teacher.email || teacher.id || '').trim() || String(teacher.id);
}

/**
 * Same mapping as UserManagement teacherFilterOptions — no extra status filter.
 * GET /teachers already returns the active school directory for admin.
 */
export function normalizeTeacherOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((t) => t?.id != null && String(t.id).trim() !== '')
    .map((t) => ({
      value: String(t.id),
      label: teacherOptionLabel(t),
    }));
}

/**
 * @param {{
 *   value?: string | null,
 *   onChange: (teacherId: string) => void,
 *   teachers?: Array<{ id: string, name?: string, email?: string, status?: string }>,
 *   id?: string,
 *   label?: string,
 *   allowEmpty?: boolean,
 *   emptyLabel?: string,
 *   disabled?: boolean,
 *   className?: string,
 *   selectClassName?: string,
 *   'data-testid'?: string,
 * }} props
 */
export default function AssignedTeacherSelect({
  value = '',
  onChange,
  teachers: teachersProp,
  id = 'assigned-teacher',
  label = 'Преподаватель',
  allowEmpty = true,
  emptyLabel = 'Не назначен',
  disabled = false,
  className,
  selectClassName,
  'data-testid': testId = 'assigned-teacher-select',
}) {
  const [loaded, setLoaded] = useState([]);
  // Only treat as "parent-provided" when the prop is actually passed (incl. []).
  // undefined → self-fetch via api.teachers.list() (UserManagement/Groups source).
  const hasTeachersProp = teachersProp !== undefined;
  const [loading, setLoading] = useState(!hasTeachersProp);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasTeachersProp) {
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const result = await api.teachers.list();
        if (cancelled) return;
        // Match UserManagement: Array.isArray(rows) ? rows : []
        setLoaded(Array.isArray(result) ? result : []);
      } catch (err) {
        if (cancelled) return;
        setLoaded([]);
        setError(err?.message || 'Не удалось загрузить преподавателей');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasTeachersProp, teachersProp]);

  const sourceRows = hasTeachersProp ? teachersProp : loaded;
  const options = useMemo(() => normalizeTeacherOptions(sourceRows), [sourceRows]);

  const selectValue = value ? String(value) : '';

  return (
    <div className={cn('space-y-2 min-w-0', className)}>
      {label ? (
        <Label htmlFor={id}>{label}</Label>
      ) : null}
      <select
        id={id}
        className={cn(fieldClass, selectClassName)}
        value={selectValue}
        disabled={disabled || loading}
        data-testid={testId}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {loading ? (
        <p className="text-xs text-muted-foreground">Загрузка преподавателей…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Преподаватели не найдены</p>
      ) : null}
    </div>
  );
}
