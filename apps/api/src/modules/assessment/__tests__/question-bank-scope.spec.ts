import { QuestionBankScope } from '../enums/question-bank-scope';

describe('QuestionBankScope', () => {
  it('keeps assessment and exam_content partitions', () => {
    expect(QuestionBankScope.Assessment).toBe('assessment');
    expect(QuestionBankScope.ExamContent).toBe('exam_content');
  });
});
