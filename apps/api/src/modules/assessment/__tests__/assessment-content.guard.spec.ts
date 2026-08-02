import { ConflictException } from '@nestjs/common';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ContentLifecycleStatus } from '../enums';

describe('AssessmentContentGuard', () => {
  const guard = new AssessmentContentGuard();

  it('allows editing draft and published content', () => {
    expect(() =>
      guard.assertEditable(ContentLifecycleStatus.Draft, 'Question'),
    ).not.toThrow();
    expect(() =>
      guard.assertEditable(ContentLifecycleStatus.Published, 'Exam'),
    ).not.toThrow();
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Published, 'Exam'),
    ).not.toThrow();
  });

  it('blocks editing archived content', () => {
    expect(() =>
      guard.assertEditable(ContentLifecycleStatus.Archived, 'Question'),
    ).toThrow(ConflictException);
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Archived, 'Question'),
    ).toThrow(/archived/);
  });

  it('publish only from draft (not published or archived)', () => {
    expect(() =>
      guard.assertCanPublish(ContentLifecycleStatus.Draft, 'Exam'),
    ).not.toThrow();
    expect(() =>
      guard.assertCanPublish(ContentLifecycleStatus.Published, 'Exam'),
    ).toThrow(/already published/);
    expect(() =>
      guard.assertCanPublish(ContentLifecycleStatus.Archived, 'Exam'),
    ).toThrow(/archived/);
  });
});
