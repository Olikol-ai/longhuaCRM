import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/design-system';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday-start week containing `anchor` (local calendar). */
function weekRangeContaining(anchor = new Date()) {
  const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const weekday = (day.getDay() + 6) % 7; // Mon=0
  const monday = new Date(day);
  monday.setDate(day.getDate() - weekday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

function nextWeekRange() {
  const { from } = weekRangeContaining();
  const [y, m, d] = from.split('-').map(Number);
  const monday = new Date(y, m - 1, d + 7);
  return weekRangeContaining(monday);
}

function formatDayHeading(isoDate, weekday) {
  const label = WEEKDAY_LABELS[weekday] ?? '';
  const [, month, day] = String(isoDate).split('-');
  return `${label} ${day}.${month}`;
}

function formatIntervals(intervals) {
  if (!intervals?.length) return '—';
  return intervals.map((slot) => `${slot.from}–${slot.to}`).join(', ');
}

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'tomorrow', label: 'Завтра' },
  { id: 'this_week', label: 'Эта неделя' },
  { id: 'next_week', label: 'Следующая неделя' },
  { id: 'custom', label: 'Произвольный период' },
];

/**
 * Admin dialog: free time = teacher availability − occupying lessons.
 */
export default function TeacherFreeScheduleDialog({ open, onOpenChange }) {
  const [period, setPeriod] = useState('this_week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });

  const resolvedRange = useMemo(() => {
    const today = new Date();
    if (period === 'today') {
      const iso = toIsoDate(today);
      return { from: iso, to: iso };
    }
    if (period === 'tomorrow') {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      const iso = toIsoDate(t);
      return { from: iso, to: iso };
    }
    if (period === 'next_week') {
      return nextWeekRange();
    }
    if (period === 'custom') {
      return {
        from: customFrom || '',
        to: customTo || customFrom || '',
      };
    }
    return weekRangeContaining(today);
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!resolvedRange.from || !resolvedRange.to) {
      setError('Укажите период');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.schedule.getFreeSchedule({
        from: resolvedRange.from,
        to: resolvedRange.to,
      });
      setRows(Array.isArray(data.teachers) ? data.teachers : []);
      setRange({ from: data.from || resolvedRange.from, to: data.to || resolvedRange.to });
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Не удалось загрузить свободный график');
    } finally {
      setLoading(false);
    }
  }, [resolvedRange.from, resolvedRange.to]);

  useEffect(() => {
    if (!open) return undefined;
    if (period === 'custom' && (!customFrom || !customTo)) return undefined;
    void load();
    return undefined;
  }, [open, period, customFrom, customTo, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle>Свободный график преподавателей</DialogTitle>
          <DialogDescription>
            Свободное время = заявленная доступность минус уже назначенные занятия
            (включая recurring).
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border flex flex-wrap items-end gap-3 shrink-0">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Период</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background min-w-[180px]"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {period === 'custom' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">С</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">По</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
                />
              </div>
            </>
          ) : null}
          <Button type="button" intent="outline" onClick={() => void load()} disabled={loading}>
            Обновить
          </Button>
          {range.from ? (
            <p className="text-xs text-muted-foreground ml-auto">
              {range.from === range.to ? range.from : `${range.from} — ${range.to}`}
            </p>
          ) : null}
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Считаем свободные интервалы…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-6 text-center">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Нет активных преподавателей
            </p>
          ) : (
            rows.map((teacher) => (
              <section
                key={teacher.teacherId}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-foreground">
                    {teacher.teacherName}
                  </h3>
                  {!teacher.hasSchedule ? (
                    <span className="text-xs text-amber-800">
                      График доступности не задан
                    </span>
                  ) : null}
                </div>
                {teacher.hasSchedule ? (
                  <div className="space-y-2">
                    {teacher.days.map((day) => (
                      <div
                        key={day.date}
                        className="grid grid-cols-[88px_1fr] gap-3 text-sm items-start"
                      >
                        <div className="font-medium text-foreground">
                          {formatDayHeading(day.date, day.weekday)}
                        </div>
                        <div className="text-muted-foreground">
                          {day.free.length === 0 ? (
                            <span className="text-destructive/90">Нет свободного времени</span>
                          ) : (
                            <span className="text-foreground">{formatIntervals(day.free)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Задайте доступность в профиле преподавателя, чтобы считать свободные слоты.
                  </p>
                )}
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
