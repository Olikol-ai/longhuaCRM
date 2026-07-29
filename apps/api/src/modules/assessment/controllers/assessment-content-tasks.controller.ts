import {
  Body,
  Controller,
  Delete,
  Get,
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
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { SecureFilesService } from '../../files/secure-files.service';
import { UploadedFilePayload } from '../../files/uploaded-file.types';
import { ContentLifecycleStatus } from '../enums';
import { ContentTaskService } from '../services/content-task.service';

class CreateContentTaskDto {
  @IsEnum(['listening', 'reading'])
  task_type: 'listening' | 'reading';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsUUID()
  audio_attachment_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  question_ids?: string[];
}

class UpdateContentTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  text_content?: string | null;

  @IsOptional()
  @IsUUID()
  audio_attachment_id?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  question_ids?: string[];

  @IsOptional()
  @IsEnum(ContentLifecycleStatus)
  status?: ContentLifecycleStatus;
}

@Controller('assessment/content-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentContentTasksController {
  constructor(
    private readonly contentTasks: ContentTaskService,
    private readonly secureFiles: SecureFilesService,
  ) {}

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('task_type') taskType?: 'listening' | 'reading',
  ) {
    return this.contentTasks.list(user, taskType);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateContentTaskDto) {
    return this.contentTasks.create(user, {
      taskType: dto.task_type,
      title: dto.title,
      textContent: dto.text_content,
      audioAttachmentId: dto.audio_attachment_id,
      questionIds: dto.question_ids,
    });
  }

  @Get(':id')
  @Roles('admin', 'teacher', 'tutor')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.contentTasks.get(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentTaskDto,
  ) {
    return this.contentTasks.update(user, id, {
      title: dto.title,
      textContent: dto.text_content,
      audioAttachmentId: dto.audio_attachment_id,
      questionIds: dto.question_ids,
      status: dto.status,
    });
  }

  @Post(':id/audio')
  @Roles('admin', 'teacher', 'tutor')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadAudio(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    const uploaded = file as UploadedFilePayload & { mimetype?: string };
    const storageKey = this.secureFiles.saveUploadedFile(file);
    return this.contentTasks.uploadAudio(user, id, {
      storageKey,
      mime: uploaded.mimetype ?? null,
      originalFilename: file.originalname ?? null,
    });
  }

  @Post(':id/publish')
  @Roles('admin', 'teacher', 'tutor')
  publish(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.contentTasks.publish(user, id);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.contentTasks.remove(user, id);
  }
}
