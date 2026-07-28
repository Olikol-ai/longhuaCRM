import { AssessmentScoringService } from '../services/assessment-scoring.service';
import { QuestionType, EvaluationType } from '../enums';

describe('AssessmentScoringService.scoreFromData (shared engine)', () => {
  const scoring = new AssessmentScoringService({} as never);

  it('scores single choice correctly for homework/exam snapshots', () => {
    const qId = 'q1';
    const correct = 'a1';
    const wrong = 'a2';
    const result = scoring.scoreFromData({
      questionSnapshots: [
        { id: qId, sectionKey: 'test', type: QuestionType.SingleChoice, points: 2 },
      ],
      answers: [
        {
          id: 'ans1',
          questionSnapshotId: qId,
          selectedAnswerSnapshotIds: [correct],
          textAnswer: null,
        },
      ],
      answerSnapshotsByQuestionId: new Map([
        [
          qId,
          [
            { id: correct, isCorrect: true },
            { id: wrong, isCorrect: false },
          ],
        ],
      ]),
      passingRule: { passScorePercent: 60 },
    });

    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(2);
    expect(result.percent).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.evaluationType).toBe(EvaluationType.Automatic);
    expect(result.requiresManualReview).toBe(false);
  });

  it('marks short_text as requiring manual review', () => {
    const result = scoring.scoreFromData({
      questionSnapshots: [
        { id: 'q2', sectionKey: 'writing', type: QuestionType.ShortText, points: 5 },
      ],
      answers: [
        {
          id: 'ans2',
          questionSnapshotId: 'q2',
          selectedAnswerSnapshotIds: [],
          textAnswer: 'hello',
        },
      ],
      answerSnapshotsByQuestionId: new Map(),
    });

    expect(result.requiresManualReview).toBe(true);
    expect(result.evaluationType).toBe(EvaluationType.Manual);
    expect(result.questions[0].requiresManualReview).toBe(true);
  });
});
