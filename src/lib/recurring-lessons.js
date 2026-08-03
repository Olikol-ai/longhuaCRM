/**
 * Create a one-off lesson or a weekly recurrence series.
 * Weekly series are created via POST /lessons/recurring (rolling 12-week horizon).
 */
export async function createWeeklyLessonSeries(createLesson, data, repeatWeekly, options = {}) {
  const createRecurring = options.createRecurring;
  const untilDate = options.untilDate ?? data?.recurrence_until ?? data?.until_date ?? null;

  if (!repeatWeekly) {
    await createLesson(data);
    return;
  }

  if (typeof createRecurring !== 'function') {
    throw new Error('createRecurring is required for weekly lessons');
  }

  const payload = {
    ...data,
    ...(untilDate ? { until_date: untilDate, untilDate } : {}),
  };
  delete payload.is_recurring;
  delete payload.recurring_group_id;
  delete payload.recurrence_until;
  delete payload.recurrence_weekly;

  await createRecurring(payload);
}
