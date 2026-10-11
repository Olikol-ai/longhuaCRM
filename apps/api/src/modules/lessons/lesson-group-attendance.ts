/**
 * Group lesson participants are snapshotted into attendance at lesson create.
 * Live group_members must not rewrite that snapshot afterwards.
 */
export function shouldResyncGroupAttendanceFromMembership(
  _lessonStatus?: string | null,
): boolean {
  return false;
}

/**
 * Prefer the lesson attendance snapshot; fall back to live members only when
 * attendance was never seeded (legacy / edge cases).
 */
export function resolveGroupLessonStudentIds(input: {
  attendanceStudentIds: Array<string | null | undefined>;
  liveMemberIds: Array<string | null | undefined>;
}): string[] {
  const fromAttendance = [
    ...new Set(input.attendanceStudentIds.filter((id): id is string => Boolean(id))),
  ];
  if (fromAttendance.length > 0) {
    return fromAttendance;
  }
  return [...new Set(input.liveMemberIds.filter((id): id is string => Boolean(id)))];
}
