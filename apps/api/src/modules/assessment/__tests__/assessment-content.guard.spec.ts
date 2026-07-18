import { ConflictException } from '@nestjs/common';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ContentLifecycleStatus } from '../enums';

describe('AssessmentContentGuard', () => {
  const guard = new AssessmentContentGuard();

  it('published entity cannot be edited', () => {
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Published, 'Bank'),
    ).toThrow(ConflictException);
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Published, 'Bank'),
    ).toThrow(/only be edited while draft/);
  });

  it('archived entity cannot be edited', () => {
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Archived, 'Question'),
    ).toThrow(ConflictException);
  });

  it('draft entity can be edited', () => {
    expect(() =>
      guard.assertDraft(ContentLifecycleStatus.Draft, 'Bank'),
    ).not.toThrow();
  });
});
