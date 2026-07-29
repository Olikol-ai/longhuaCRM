import { BadRequestException } from '@nestjs/common';
import { ExamService } from '../services/exam.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ContentLifecycleStatus } from '../enums';

describe('ExamService create from blocks', () => {
  const exams = {
    save: jest.fn(),
    saveRule: jest.fn(),
    findWithStructure: jest.fn(),
    replaceSectionsAndQuestions: jest.fn(),
    replaceExamQuestions: jest.fn(),
  };

  const blocks = {
    findWithItemsOrdered: jest.fn(),
  };
  const questions = {};
  const assignments = { count: jest.fn(), manager: { query: jest.fn() } };
  const access = {
    assertCanManageContent: jest.fn(),
    assertCanManageCreatedContent: jest.fn(),
  };
  const journal = { record: jest.fn().mockResolvedValue(undefined) };

  const parts = { save: jest.fn(), delete: jest.fn(), create: jest.fn() };
  const poolItems = { save: jest.fn(), delete: jest.fn(), create: jest.fn() };
  const contentTasks = {};

  const service = new ExamService(
    exams as never,
    blocks as never,
    questions as never,
    assignments as never,
    parts as never,
    poolItems as never,
    contentTasks as never,
    new AssessmentContentGuard(),
    access as never,
    journal as never,
  );

  const actor = { sub: 'teacher-1', role: 'teacher', email: 't@test.local' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires block_ids', async () => {
    await expect(
      service.create(
        {
          name: 'Exam',
          blockIds: [],
          rule: { durationMinutes: 60 },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('materializes exam from published blocks', async () => {
    blocks.findWithItemsOrdered.mockResolvedValue([
      {
        id: 'b1',
        name: 'Block A',
        description: 'desc',
        durationMinutes: 15,
        levelLabel: 'HSK1',
        status: ContentLifecycleStatus.Published,
        createdByUserId: 'teacher-1',
        items: [
          { questionId: 'q1', sortOrder: 0 },
          { questionId: 'q2', sortOrder: 1 },
        ],
      },
    ]);
    exams.save.mockResolvedValue({
      id: 'exam-1',
      name: 'My exam',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
    });
    exams.replaceSectionsAndQuestions.mockResolvedValue({
      sections: [
        {
          id: 'sec-1',
          sectionKey: 'block_1',
          title: 'Block A',
        },
      ],
      examQuestions: [],
    });
    exams.findWithStructure.mockResolvedValue({
      id: 'exam-1',
      name: 'My exam',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'teacher-1',
      sections: [],
      examQuestions: [],
    });

    const created = await service.create(
      {
        name: 'My exam',
        blockIds: ['b1'],
        rule: { durationMinutes: 45, passScorePercent: 60 },
      },
      actor,
    );

    expect(created.id).toBe('exam-1');
    expect(exams.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My exam' }),
    );
    expect(exams.replaceExamQuestions).toHaveBeenCalledWith(
      'exam-1',
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'q1', sectionId: 'sec-1' }),
        expect.objectContaining({ questionId: 'q2', sectionId: 'sec-1' }),
      ]),
    );
    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Exam', action: 'create' }),
    );
  });

  it('rejects draft blocks', async () => {
    blocks.findWithItemsOrdered.mockResolvedValue([
      {
        id: 'b1',
        name: 'Draft block',
        status: ContentLifecycleStatus.Draft,
        createdByUserId: 'teacher-1',
        items: [{ questionId: 'q1', sortOrder: 0 }],
      },
    ]);

    await expect(
      service.create(
        {
          name: 'Exam',
          blockIds: ['b1'],
          rule: { durationMinutes: 30 },
        },
        actor,
      ),
    ).rejects.toThrow();
  });
});
