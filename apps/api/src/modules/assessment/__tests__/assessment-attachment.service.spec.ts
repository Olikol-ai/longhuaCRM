import { ForbiddenException, NotFoundException, StreamableFile } from '@nestjs/common';
import { AssessmentAttachmentService } from '../services/assessment-attachment.service';
import {
  AssessmentAttemptRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { SecureFilesService } from '../../files/secure-files.service';

describe('AssessmentAttachmentService', () => {
  const questions = {
    findAttachmentById: jest.fn(),
    findById: jest.fn(),
  } as unknown as jest.Mocked<AssessmentQuestionRepository>;

  const attempts = {
    userHasSnapshotForSourceQuestion: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAttemptRepository>;

  const secureFiles = {
    streamByStorageKey: jest.fn(),
  } as unknown as jest.Mocked<SecureFilesService>;

  const service = new AssessmentAttachmentService(questions, attempts, secureFiles);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unauthorized cannot download attachment', async () => {
    questions.findAttachmentById.mockResolvedValue({
      id: 'att-file-1',
      questionId: 'q-1',
      storageKey: '/uploads/a.pdf',
      mime: 'application/pdf',
      originalFilename: 'a.pdf',
    } as never);
    questions.findById.mockResolvedValue({ id: 'q-1' } as never);
    attempts.userHasSnapshotForSourceQuestion.mockResolvedValue(false);

    await expect(
      service.download('att-file-1', { sub: 'student-1', role: 'student' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(secureFiles.streamByStorageKey).not.toHaveBeenCalled();
  });

  it('student with snapshot access can download', async () => {
    questions.findAttachmentById.mockResolvedValue({
      id: 'att-file-1',
      questionId: 'q-1',
      storageKey: '/uploads/a.pdf',
      mime: 'application/pdf',
      originalFilename: 'a.pdf',
    } as never);
    questions.findById.mockResolvedValue({ id: 'q-1' } as never);
    attempts.userHasSnapshotForSourceQuestion.mockResolvedValue(true);
    const stream = {} as StreamableFile;
    secureFiles.streamByStorageKey.mockReturnValue(stream);

    const result = await service.download('att-file-1', {
      sub: 'student-1',
      role: 'student',
    });

    expect(result).toBe(stream);
    expect(secureFiles.streamByStorageKey).toHaveBeenCalledWith('/uploads/a.pdf', {
      mime: 'application/pdf',
      filename: 'a.pdf',
      disposition: 'inline',
    });
  });

  it('returns 404 when attachment missing', async () => {
    questions.findAttachmentById.mockResolvedValue(null);
    await expect(
      service.download('missing', { sub: 'admin-1', role: 'admin' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
