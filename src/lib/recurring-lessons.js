import { addDays, format, parseISO } from 'date-fns';

export async function createWeeklyLessonSeries(createLesson, data, repeatWeekly) {
  if (!repeatWeekly) {
    await createLesson(data);
    return;
  }

  const groupId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  const baseDate = parseISO(data.date);
  const dates = [
    format(baseDate, 'yyyy-MM-dd'),
    format(addDays(baseDate, 7), 'yyyy-MM-dd'),
  ];

  for (const date of dates) {
    await createLesson({
      ...data,
      date,
      is_recurring: true,
      recurring_group_id: groupId,
    });
  }
}
