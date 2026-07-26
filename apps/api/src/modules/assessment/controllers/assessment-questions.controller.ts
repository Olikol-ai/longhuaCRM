import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { SecureFilesService } from '../../files/secure-files.service';
import { UploadedFilePayload } from '../../files/uploaded-file.types';
import {
  CreateAttachmentDto,
  CreateQuestionDto,
  ListQuestionsQueryDto,
  UpdateQuestionDto,
  paginateArray,
} from '../dto';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { QuestionAuthoringService } from '../services/question-authoring.service';

@ApiTags('Assessment Questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/questions')
export class AssessmentQuestionsController {
  constructor(
    private readonly questions: QuestionAuthoringService,
    private readonly guard: AssessmentContentGuard,
    private readonly secureFiles: SecureFilesService,
  ) {}

  @Post()
  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create question in bank' })
  @ApiResponse({ status: 201, description: 'Question created' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questions.create({
      bankId: dto.bank_id,
      type: dto.type,
      stem: dto.stem,
      points: dto.points,
      difficulty: dto.difficulty,
      explanation: dto.explanation ?? null,
      topicIds: dto.topic_ids,
      answers: dto.answers?.map((a) => ({
        text: a.text,
        isCorrect: a.is_correct,
        sortOrder: a.sort_order,
      })),
      createdByUserId: user.sub,
    });
  }

  @Get()
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'List and filter questions' })
  @ApiResponse({ status: 200, description: 'Paginated question list' })
  async list(@Query() query: ListQuestionsQueryDto) {
    const items = await this.questions.listFiltered({
      bankId: query.bank_id,
      status: query.status,
      type: query.type,
      topicId: query.topic_id,
      difficultyMin: query.difficulty_min,
      difficultyMax: query.difficulty_max,
      search: query.search,
    });
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':questionId')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Get question detail' })
  @ApiResponse({ status: 200, description: 'Question detail' })
  async findOne(@Param('questionId', ParseUUIDPipe) questionId: string) {
    return this.guard.requireFound(await this.questions.findById(questionId), 'Question');
  }

  @Patch(':questionId')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Update draft question' })
  @ApiResponse({ status: 200, description: 'Question updated' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questions.update(user, questionId, {
      type: dto.type,
      stem: dto.stem,
      points: dto.points,
      difficulty: dto.difficulty,
      explanation: dto.explanation,
      topicIds: dto.topic_ids,
      answers: dto.answers?.map((a) => ({
        text: a.text,
        isCorrect: a.is_correct,
        sortOrder: a.sort_order,
      })),
    });
  }

  @Delete(':questionId')
  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete question (admin or author). Hard-delete when unused; archive when used in exams.',
  })
  @ApiResponse({ status: 204, description: 'Question deleted or archived' })
  @ApiResponse({ status: 403, description: 'Not admin and not the question author' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    await this.questions.deleteQuestion(user, questionId);
  }

  @Post(':questionId/publish')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Publish question' })
  @ApiResponse({ status: 200, description: 'Question published' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.questions.publish(user, questionId);
  }

  @Post(':questionId/archive')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Archive question' })
  @ApiResponse({ status: 200, description: 'Question archived' })
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.questions.archive(user, questionId);
  }

  @Post(':questionId/attachments')
  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload question attachment' })
  @ApiResponse({ status: 201, description: 'Attachment created' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  addAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CreateAttachmentDto,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    const uploaded = file as UploadedFilePayload & { mimetype?: string };
    const storageKey = this.secureFiles.saveUploadedFile(file);
    return this.questions.addAttachment(user, questionId, {
      kind: dto.kind,
      storageKey,
      mime: uploaded.mimetype ?? null,
      originalFilename: file.originalname ?? null,
    });
  }

  @Delete(':questionId/attachments/:attachmentId')
  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete question attachment' })
  @ApiResponse({ status: 204, description: 'Attachment deleted' })
  async removeAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.questions.removeAttachment(user, questionId, attachmentId);
  }
}
