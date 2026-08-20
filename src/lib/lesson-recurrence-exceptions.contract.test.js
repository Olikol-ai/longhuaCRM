import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('recurring lesson exception integrity', () => {
  it('persists series date exceptions and uses them in fillHorizon', () => {
    const service = read('apps/api/src/modules/lessons/lesson-recurrence.service.ts');
    const exceptions = read(
      'apps/api/src/modules/lessons/lesson-recurrence-exceptions.service.ts',
    );
    const migration = read(
      'apps/api/src/database/migrations/1746200000000-LessonRecurrenceExceptions.ts',
    );
    assert.match(migration, /lesson_recurrence_exceptions/);
    assert.match(exceptions, /markSkipped/);
    assert.match(exceptions, /listSkippedDates/);
    assert.match(exceptions, /withSeriesLock|pg_advisory_lock/);
    assert.match(exceptions, /recordExceptionThen/);
    assert.match(service, /listSkippedDates/);
    assert.match(service, /withSeriesLock/);
    assert.match(service, /hasSkippedDate/);
    assert.match(service, /occupiedDates\.add/);
  });

  it('records exceptions atomically on reschedule, cancel, delete, and detach', () => {
    const lessons = read('apps/api/src/modules/lessons/lessons.service.ts');
    const recurrence = read('apps/api/src/modules/lessons/lesson-recurrence.service.ts');
    assert.match(lessons, /recordExceptionThen\([\s\S]*'rescheduled'/);
    assert.match(lessons, /markSkipped\([\s\S]*'cancelled'/);
    assert.match(lessons, /recordExceptionThen\([\s\S]*'deleted'/);
    assert.match(recurrence, /recordExceptionThen\([\s\S]*'detached'/);
    // Cancel takes the series lock around the cancel transaction.
    assert.match(lessons, /withSeriesLock\([\s\S]*runCancel|withSeriesLock\([\s\S]*preview\.recurrenceSeriesId/);
  });
});
