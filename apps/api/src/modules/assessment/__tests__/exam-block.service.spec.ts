import { BadRequestException, ConflictException } from '@nestjs/common';
import { ExamBlockService } from '../services/exam-block.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ContentLifecycleStatus } from '../enums';

describe('ExamBlockService', () => {
  const blocks = {
    findWithItems: jest.fn(),
    findAll: jest.fn(),
    filterByStatus: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    replaceItems: jest.fn(),
    findItemsByBlockId: jest.fn(),
    isBlockUsedInExams: jest.fn(),
  };

  const questions = {
    findByIdsWithAnswers: jest.fn(),
  };

  const assignments = {
    manager: { query: jest.fn() },
  };

  const access = {
    assertCanManageContent: jest.fn(),
    assertCanManageCreatedContent: jest.fn(),
    canManageCreatedContent: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn().mockReturnValue(false),
  };

  const journal = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ExamBlockService(
    blocks as never,
    questions as never,
    assignments as never,
    new AssessmentContentGuard(),
    access as never,
    journal as never,
  );

  const actor = { sub: 'teacher-1', role: 'teacher', email: 't@test.local' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a draft block and writes journal', async () => {
    blocks.save.mockResolvedValue({
      id: 'block-1',
      name: 'Listening',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
    });
    blocks.findWithItems.mockResolvedValue({
      id: 'block-1',
      name: 'Listening',
      description: null,
      levelLabel: null,
      durationMinutes: null,
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
      items: [],
    });

    const created = await service.create(actor, { name: 'Listening' });

    expect(created.id).toBe('block-1');
    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ExamBlock',
        action: 'create',
        entityId: 'block-1',
      }),
    );
  });

  it('refuses publish without questions', async () => {
    blocks.findWithItems.mockResolvedValue({
      id: 'block-1',
      name: 'Empty',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
      items: [],
    });

    await expect(service.publish(actor, 'block-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('hard-deletes unused block', async () => {
    blocks.findWithItems.mockResolvedValue({
      id: 'block-1',
      name: 'Temp',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
      items: [],
    });
    blocks.isBlockUsedInExams.mockResolvedValue(false);
    assignments.manager.query.mockResolvedValue([]);

    const result = await service.deleteOrArchive(actor, 'block-1');

    expect(result.mode).toBe('hard');
    expect(blocks.delete).toHaveBeenCalledWith('block-1');
  });

  it('archives used block instead of hard delete', async () => {
    blocks.findWithItems
      .mockResolvedValueOnce({
        id: 'block-1',
        name: 'Used',
        status: ContentLifecycleStatus.Published,
        createdByUserId: 'teacher-1',
        items: [{ questionId: 'q1', sortOrder: 0 }],
      })
      .mockResolvedValueOnce({
        id: 'block-1',
        name: 'Used',
        status: ContentLifecycleStatus.Published,
        createdByUserId: 'teacher-1',
        items: [{ questionId: 'q1', sortOrder: 0 }],
      })
      .mockResolvedValueOnce({
        id: 'block-1',
        name: 'Used',
        status: ContentLifecycleStatus.Archived,
        createdByUserId: 'teacher-1',
        items: [{ questionId: 'q1', sortOrder: 0 }],
      });
    blocks.isBlockUsedInExams.mockResolvedValue(true);
    blocks.update.mockResolvedValue({ id: 'block-1' });

    const result = await service.deleteOrArchive(actor, 'block-1');

    expect(result.mode).toBe('soft');
    expect(blocks.update).toHaveBeenCalledWith('block-1', {
      status: ContentLifecycleStatus.Archived,
    });
  });

  it('rejects second hard delete when already archived and used', async () => {
    blocks.findWithItems.mockResolvedValue({
      id: 'block-1',
      name: 'Used',
      status: ContentLifecycleStatus.Archived,
      createdByUserId: 'teacher-1',
      items: [],
    });
    blocks.isBlockUsedInExams.mockResolvedValue(true);

    await expect(service.deleteOrArchive(actor, 'block-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
