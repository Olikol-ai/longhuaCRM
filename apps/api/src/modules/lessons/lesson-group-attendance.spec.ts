import {
  resolveGroupLessonStudentIds,
  shouldResyncGroupAttendanceFromMembership,
} from './lesson-group-attendance';

describe('group lesson attendance snapshot', () => {
  it('never resyncs live membership into existing lessons', () => {
    expect(shouldResyncGroupAttendanceFromMembership('planned')).toBe(false);
    expect(shouldResyncGroupAttendanceFromMembership('completed')).toBe(false);
    expect(shouldResyncGroupAttendanceFromMembership(null)).toBe(false);
  });

  it('prefers attendance snapshot over live members', () => {
    expect(
      resolveGroupLessonStudentIds({
        attendanceStudentIds: ['a', 'b'],
        liveMemberIds: ['a', 'c'],
      }),
    ).toEqual(['a', 'b']);
  });

  it('falls back to live members only when attendance is empty', () => {
    expect(
      resolveGroupLessonStudentIds({
        attendanceStudentIds: [],
        liveMemberIds: ['x', 'y', null],
      }),
    ).toEqual(['x', 'y']);
  });
});
