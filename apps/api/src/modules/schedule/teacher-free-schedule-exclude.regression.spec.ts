import {
  computeFreeClockIntervals,
} from './teacher-free-schedule.util';

/**
 * Lightweight regression for excludeLessonId semantics used by checkAvailability.
 * Intervals only — service wires exclude before calling the util.
 */
describe('teacher free schedule excludeLessonId contract', () => {
  it('excluding the edited lesson leaves the slot free', () => {
    const availability = [{ from: '09:00', to: '18:00' }];
    const allBusy = [
      { from: '10:00', to: '11:00', id: 'self' },
      { from: '15:00', to: '16:00', id: 'other' },
    ];
    const withoutSelf = allBusy
      .filter((row) => row.id !== 'self')
      .map(({ from, to }) => ({ from, to }));
    expect(computeFreeClockIntervals(availability, withoutSelf)).toEqual([
      { from: '09:00', to: '15:00' },
      { from: '16:00', to: '18:00' },
    ]);
  });

  it('two recurring series of the same teacher merge into busy blocks', () => {
    const free = computeFreeClockIntervals(
      [{ from: '09:00', to: '18:00' }],
      [
        { from: '10:00', to: '11:00' }, // series A
        { from: '14:00', to: '15:00' }, // series B
      ],
    );
    expect(free).toEqual([
      { from: '09:00', to: '10:00' },
      { from: '11:00', to: '14:00' },
      { from: '15:00', to: '18:00' },
    ]);
  });
});
