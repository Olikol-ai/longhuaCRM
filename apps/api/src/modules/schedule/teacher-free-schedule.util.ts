/**
 * Pure interval arithmetic for teacher free-schedule:
 * free = availability − merged(busy lessons).
 *
 * Times are minutes from midnight (0..1440).
 */

export type MinuteInterval = {
  fromMin: number;
  toMin: number;
};

export type ClockInterval = {
  from: string;
  to: string;
};

/** Parse "HH:MM" / "HH:MM:SS" → minutes. Invalid → NaN. */
export function clockToMinutes(time: string): number {
  const parts = String(time ?? '').split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
}

/** Minutes → "HH:MM". */
export function minutesToClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.floor(totalMinutes)));
  const hours = Math.floor(clamped / 60) % 24;
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function clockIntervalToMinutes(slot: ClockInterval): MinuteInterval | null {
  const fromMin = clockToMinutes(slot.from);
  const toMin = clockToMinutes(slot.to);
  if (!Number.isFinite(fromMin) || !Number.isFinite(toMin) || fromMin >= toMin) {
    return null;
  }
  return { fromMin, toMin };
}

export function minutesToClockInterval(slot: MinuteInterval): ClockInterval {
  return {
    from: minutesToClock(slot.fromMin),
    to: minutesToClock(slot.toMin),
  };
}

/**
 * Sort by start, merge overlapping / touching busy intervals.
 * Touching (10:00–11:00 + 11:00–12:00) merges to 10:00–12:00.
 */
export function mergeBusyIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const valid = intervals
    .filter((row) => Number.isFinite(row.fromMin) && Number.isFinite(row.toMin) && row.fromMin < row.toMin)
    .map((row) => ({ fromMin: row.fromMin, toMin: row.toMin }))
    .sort((a, b) => a.fromMin - b.fromMin || a.toMin - b.toMin);

  if (valid.length === 0) {
    return [];
  }

  const merged: MinuteInterval[] = [{ ...valid[0] }];
  for (let i = 1; i < valid.length; i += 1) {
    const current = valid[i];
    const last = merged[merged.length - 1];
    if (current.fromMin <= last.toMin) {
      last.toMin = Math.max(last.toMin, current.toMin);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/**
 * Subtract busy intervals from availability windows.
 * Busy intervals should already be merged for best results (caller may pass raw).
 */
export function subtractBusyFromAvailability(
  availability: MinuteInterval[],
  busy: MinuteInterval[],
): MinuteInterval[] {
  const avail = mergeBusyIntervals(availability);
  const blocked = mergeBusyIntervals(busy);
  if (avail.length === 0) {
    return [];
  }
  if (blocked.length === 0) {
    return avail;
  }

  const free: MinuteInterval[] = [];
  for (const window of avail) {
    let cursor = window.fromMin;
    const end = window.toMin;
    for (const block of blocked) {
      if (block.toMin <= cursor) {
        continue;
      }
      if (block.fromMin >= end) {
        break;
      }
      if (block.fromMin > cursor) {
        free.push({ fromMin: cursor, toMin: Math.min(block.fromMin, end) });
      }
      cursor = Math.max(cursor, block.toMin);
      if (cursor >= end) {
        break;
      }
    }
    if (cursor < end) {
      free.push({ fromMin: cursor, toMin: end });
    }
  }
  return free.filter((row) => row.fromMin < row.toMin);
}

/** Clock-level convenience for tests and services. */
export function computeFreeClockIntervals(
  availability: ClockInterval[],
  busy: ClockInterval[],
): ClockInterval[] {
  const availMin = availability
    .map(clockIntervalToMinutes)
    .filter((row): row is MinuteInterval => row !== null);
  const busyMin = busy
    .map(clockIntervalToMinutes)
    .filter((row): row is MinuteInterval => row !== null);
  return subtractBusyFromAvailability(availMin, busyMin).map(minutesToClockInterval);
}
