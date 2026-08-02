import { toResultBreakdownDto, toResultDto } from '../services/result-dto';
import { AssessmentResultBreakdownEntity, AssessmentResultEntity } from '../entities';
import { EvaluationType, ResultStatus } from '../enums';

describe('result-dto', () => {
  it('maps breakdown without circular result relation', () => {
    const parent = {
      id: 'r1',
    } as AssessmentResultEntity;
    const row = {
      id: 'b1',
      resultId: 'r1',
      sectionKey: 'listening',
      weight: '40.00',
      score: '8.00',
      maxScore: '10.00',
      result: parent,
    } as AssessmentResultBreakdownEntity;

    const dto = toResultBreakdownDto(row);
    expect(dto).toEqual({
      id: 'b1',
      result_id: 'r1',
      section_key: 'listening',
      sectionKey: 'listening',
      weight: '40.00',
      score: '8.00',
      max_score: '10.00',
      maxScore: '10.00',
    });
    expect((dto as { result?: unknown }).result).toBeUndefined();
  });

  it('maps result with nested plain breakdowns', () => {
    const result = {
      id: 'r1',
      attemptId: 'a1',
      examId: 'e1',
      status: ResultStatus.Passed,
      evaluationType: EvaluationType.Automatic,
      score: '10.00',
      maxScore: '10.00',
      percent: '100.00',
      passed: true,
      startedAt: new Date('2026-01-01T10:00:00Z'),
      finishedAt: new Date('2026-01-01T10:30:00Z'),
      duration: 1800,
      attemptNumber: 1,
      createdAt: new Date('2026-01-01T10:30:00Z'),
      updatedAt: new Date('2026-01-01T10:30:00Z'),
      breakdowns: [
        {
          id: 'b1',
          resultId: 'r1',
          sectionKey: 'test',
          weight: '100.00',
          score: '10.00',
          maxScore: '10.00',
        },
      ],
    } as AssessmentResultEntity;

    const dto = toResultDto(result);
    expect(dto.breakdowns).toHaveLength(1);
    expect(dto.breakdowns[0].section_key).toBe('test');
    expect(dto.percent).toBe('100.00');
    expect(JSON.stringify(dto)).not.toContain('"result":');
  });
});
