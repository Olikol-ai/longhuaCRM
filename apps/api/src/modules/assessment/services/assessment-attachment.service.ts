import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { normalizeRole } from '../../../common/constants/roles';
import { SecureFilesService } from '../../files/secure-files.service';
import {
  AssessmentAttemptRepository,
  AssessmentQuestionRepository,
} from '../repositories';

@Injectable()
export class AssessmentAttachmentService {
  constructor(
    private readonly questions: AssessmentQuestionRepository,
    private readonly attempts: AssessmentAttemptRepository,
    private readonly secureFiles: SecureFilesService,
  ) {}

  /**
   * Stream question attachment after ACL check.
   * Admin/teacher: authoring access to the linked question.
   * Student: only when the question appears in their Attempt Snapshot.
   */
  async download(
    attachmentId: string,
    user: { sub: string; role: string },
    disposition: 'inline' | 'attachment' = 'inline',
  ): Promise<StreamableFile> {
    const attachment = await this.questions.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const question = await this.questions.findById(attachment.questionId);
    if (!question) {
      throw new NotFoundException('Question not found for attachment');
    }

    await this.assertCanDownload(user, attachment.questionId);

    return this.secureFiles.streamByStorageKey(attachment.storageKey, {
      mime: attachment.mime,
      filename: attachment.originalFilename,
      disposition,
    });
  }

  private async assertCanDownload(
    user: { sub: string; role: string },
    questionId: string,
  ): Promise<void> {
    const role = normalizeRole(user.role);
    if (role === 'admin' || role === 'teacher') {
      return;
    }
    if (role !== 'student') {
      throw new ForbiddenException('Forbidden: cannot download attachment');
    }

    const allowed = await this.attempts.userHasSnapshotForSourceQuestion(
      user.sub,
      questionId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Forbidden: attachment is not part of your Attempt Snapshot',
      );
    }
  }
}
