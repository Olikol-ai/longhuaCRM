import {
  computeFreeClockIntervals,
  mergeBusyIntervals,
  subtractBusyFromAvailability,
  clockToMinutes,
} from './teacher-free-schedule.util';

describe('teacher-free-schedule.util', () => {
  it('merges overlapping lessons then subtracts from availability', () => {
    const free = computeFreeClockIntervals(
      [{ from: '09:00', to: '18:00' }],
      [
        { from: '10:00', to: '11:00' },
        { from: '10:30', to: '12:00' },
        { from: '15:00', to: '16:00' },
      ],
    );
    expect(free).toEqual([
      { from: '09:00', to: '10:00' },
      { from: '12:00', to: '15:00' },
      { from: '16:00', to: '18:00' },
    ]);
  });

  it('handles lesson at start and end of availability', () => {
    const free = computeFreeClockIntervals(
      [{ from: '09:00', to: '18:00' }],
      [
        { from: '09:00', to: '10:00' },
        { from: '17:00', to: '18:00' },
      ],
    );
    expect(free).toEqual([{ from: '10:00', to: '17:00' }]);
  });

  it('returns empty when day is fully booked', () => {
    const free = computeFreeClockIntervals(
      [{ from: '09:00', to: '12:00' }],
      [{ from: '09:00', to: '12:00' }],
    );
    expect(free).toEqual([]);
  });

  it('merges adjacent back-to-back lessons', () => {
    expect(
      mergeBusyIntervals([
        { fromMin: clockToMinutes('10:00'), toMin: clockToMinutes('11:00') },
        { fromMin: clockToMinutes('11:00'), toMin: clockToMinutes('12:00') },
      ]),
    ).toEqual([{ fromMin: 600, toMin: 720 }]);
  });

  it('keeps multiple availability windows', () => {
    const free = subtractBusyFromAvailability(
      [
        { fromMin: 9 * 60, toMin: 12 * 60 },
        { fromMin: 14 * 60, toMin: 18 * 60 },
      ],
      [{ fromMin: 10 * 60, toMin: 11 * 60 }],
    );
    expect(free).toEqual([
      { fromMin: 9 * 60, toMin: 10 * 60 },
      { fromMin: 11 * 60, toMin: 12 * 60 },
      { fromMin: 14 * 60, toMin: 18 * 60 },
    ]);
  });

  it('returns full availability when no busy lessons', () => {
    expect(
      computeFreeClockIntervals([{ from: '09:00', to: '18:00' }], []),
    ).toEqual([{ from: '09:00', to: '18:00' }]);
  });
});
