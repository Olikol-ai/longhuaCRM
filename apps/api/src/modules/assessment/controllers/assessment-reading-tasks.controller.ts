import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { QuestionType } from '../enums';
import { ReadingTaskService } from '../services/reading-task.service';

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

class CreateReadingTaskDto {
  @IsString()
  title!: string;

  @IsString()
  text_content!: string;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsString()
  level_label?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedQuestionDto)
  questions?: NestedQuestionDto[];
}

class UpdateReadingTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsString()
  instructions?: string | null;

  @IsOptional()
  @IsString()
  level_label?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedQuestionDto)
  questions?: NestedQuestionDto[];
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

@Controller('assessment/reading-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentReadingTasksController {
  constructor(private readonly readingTasks: ReadingTaskService) {}

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  list(@CurrentUser() user: JwtPayload) {
    return this.readingTasks.list(user);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReadingTaskDto) {
    return this.readingTasks.create(user, {
      title: dto.title,
      textContent: dto.text_content,
      instructions: dto.instructions,
      levelLabel: dto.level_label,
      questions: mapQuestions(dto.questions),
    });
  }

  @Get(':id')
  @Roles('admin', 'teacher', 'tutor')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.readingTasks.get(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReadingTaskDto,
  ) {
    return this.readingTasks.update(user, id, {
      title: dto.title,
      textContent: dto.text_content,
      instructions: dto.instructions,
      levelLabel: dto.level_label,
      questions: mapQuestions(dto.questions),
    });
  }

  @Post(':id/publish')
  @Roles('admin', 'teacher', 'tutor')
  publish(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.readingTasks.publish(user, id);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.readingTasks.remove(user, id);
  }
}
