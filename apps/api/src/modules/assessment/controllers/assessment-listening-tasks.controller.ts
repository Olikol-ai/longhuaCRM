import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { QuestionType } from '../enums';
import { ListeningTaskService } from '../services/listening-task.service';

class NestedAnswerDto {
  @IsString()
  text!: string;

  @IsBoolean()
  is_correct!: boolean;
}

class NestedQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  stem!: string;

  @IsOptional()
  points?: number | string;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedAnswerDto)
  answers?: NestedAnswerDto[];
}

class CreateListeningTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsString()
  level_label?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VocabularyItemDto)
  vocabulary?: VocabularyItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedQuestionDto)
  questions?: NestedQuestionDto[];
}

class UpdateListeningTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsString()
  level_label?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VocabularyItemDto)
  vocabulary?: VocabularyItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedQuestionDto)
  questions?: NestedQuestionDto[];
}

class VocabularyItemDto {
  @IsString()
  word!: string;

  @IsOptional()
  @IsString()
  pinyin?: string | null;

  @IsOptional()
  @IsString()
  translation?: string | null;

  @IsOptional()
  @IsString()
  explanation?: string | null;
}

function mapQuestions(questions?: NestedQuestionDto[]) {
  return questions?.map((q) => ({
    type: q.type,
    stem: q.stem,
    points: q.points,
    explanation: q.explanation,
    answers: q.answers?.map((a) => ({
      text: a.text,
      isCorrect: a.is_correct,
    })),
  }));
}

function mapVocabulary(items?: VocabularyItemDto[]) {
  return items?.map((item) => ({
    word: item.word,
    pinyin: item.pinyin,
    translation: item.translation,
    explanation: item.explanation,
  }));
}

@Controller('assessment/listening-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentListeningTasksController {
  constructor(private readonly listeningTasks: ListeningTaskService) {}

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  list(@CurrentUser() user: JwtPayload) {
    return this.listeningTasks.list(user);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateListeningTaskDto) {
    return this.listeningTasks.create(user, {
      title: dto.title,
      instructions: dto.instructions,
      levelLabel: dto.level_label,
      vocabulary: mapVocabulary(dto.vocabulary),
      questions: mapQuestions(dto.questions),
    });
  }

  @Get(':id')
  @Roles('admin', 'teacher', 'tutor')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.listeningTasks.get(user, id);
  }

  @Get(':id/audio')
  @Roles('admin', 'teacher', 'tutor', 'student')
  audio(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.listeningTasks.streamAudioForAttempt(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListeningTaskDto,
  ) {
    return this.listeningTasks.update(user, id, {
      title: dto.title,
      instructions: dto.instructions,
      levelLabel: dto.level_label,
      vocabulary: mapVocabulary(dto.vocabulary),
      questions: mapQuestions(dto.questions),
    });
  }

  @Post(':id/audio')
  @Roles('admin', 'teacher', 'tutor')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  uploadAudio(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Файл не получен. Выберите mp3, wav, ogg, m4a, aac или mov/mp4.',
      );
    }
    return this.listeningTasks.uploadAudio(user, id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Post(':id/publish')
  @Roles('admin', 'teacher', 'tutor')
  publish(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.listeningTasks.publish(user, id);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.listeningTasks.remove(user, id);
  }
}
