import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildHomeworkItemReviews,
  homeworkItemReviewHasContent,
} from './homework-item-review.js';

describe('buildHomeworkItemReviews', () => {
  const questions = [
    { id: 'q1', points: 2, explanation: null },
    { id: 'q2', points: 2, explanation: 'Эталон' },
    { id: 'q3', points: 1, explanation: '' },
  ];
  const answers = [
    {
      question_snapshot_id: 'q1',
      review_comment: '  Хороший ответ, но обрати внимание на порядок слов.  ',
      earned_points: 1.5,
      is_correct: null,
    },
    {
      question_snapshot_id: 'q2',
      review_comment: 'Отлично',
      earned_points: 2,
      is_correct: true,
    },
    {
      question_snapshot_id: 'q3',
      review_comment: '   ',
      earned_points: 0,
      is_correct: false,
    },
  ];

  it('binds each teacher comment to the matching question, not a shared list', () => {
    const reviews = buildHomeworkItemReviews(questions, answers);
    assert.equal(
      reviews.q1.comment,
      'Хороший ответ, но обрати внимание на порядок слов.',
    );
    assert.equal(reviews.q2.comment, 'Отлично');
    assert.equal(reviews.q1.earnedPoints, 1.5);
    assert.equal(reviews.q2.earnedPoints, 2);
    assert.notEqual(reviews.q1.comment, reviews.q2.comment);
  });

  it('omits empty teacher comments so the UI can hide the block', () => {
    const reviews = buildHomeworkItemReviews(questions, answers);
    assert.equal(reviews.q3.comment, null);
    assert.equal(homeworkItemReviewHasContent({ comment: null }), false);
    assert.equal(homeworkItemReviewHasContent({ comment: 'x' }), true);
    assert.equal(homeworkItemReviewHasContent(reviews.q3), true);
  });

  it('keeps expected answers on the same item as the student answer', () => {
    const reviews = buildHomeworkItemReviews(questions, answers);
    assert.equal(reviews.q1.expectedAnswer, null);
    assert.equal(reviews.q2.expectedAnswer, 'Эталон');
  });
});
