import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ExamAcademySessionService } from '../services/exam-academy-session.service';

class CreateSessionDto {
  @IsString()
  mode!: string;

  @IsUUID()
  program_version_id!: string;

  @IsUUID()
  level_id!: string;

  @IsOptional()
  @IsString()
  section_key?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  question_count?: number;

  @IsOptional()
  @IsBoolean()
  randomize?: boolean;

  @IsOptional()
  @IsString()
  show_correct_answers?: string;

  @IsOptional()
  @IsUUID()
  blueprint_id?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

class AnswerRowDto {
  @IsUUID()
  question_snapshot_id!: string;

  @IsOptional()
  @IsString()
  text_answer?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selected_answer_snapshot_ids?: string[];
}

class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerRowDto)
  answers!: AnswerRowDto[];
}

/** HSK Academy sessions — Longhua school only (not tutors / tutor_students). */
@Controller('exam-academy/sessions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'teacher', 'student')
export class ExamAcademySessionsController {
  constructor(private readonly sessions: ExamAcademySessionService) {}

  @Get()
  list(@Req() req: { user: DomainAccessActor }) {
    return this.sessions.listMine(req.user);
  }

  @Post()
  create(@Req() req: { user: DomainAccessActor }, @Body() dto: CreateSessionDto) {
    return this.sessions.create(req.user, {
      mode: dto.mode,
      programVersionId: dto.program_version_id,
      levelId: dto.level_id,
      sectionKey: dto.section_key,
      questionCount: dto.question_count,
      randomize: dto.randomize,
      showCorrectAnswers: dto.show_correct_answers,
      blueprintId: dto.blueprint_id,
      title: dto.title,
    });
  }

  @Get(':id')
  get(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.get(req.user, id);
  }

  @Post(':id/start')
  start(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.start(req.user, id);
  }

  @Get(':id/runtime')
  runtime(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.runtime(req.user, id);
  }

  @Patch(':id/answers')
  saveAnswers(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.sessions.saveAnswers(
      req.user,
      id,
      dto.answers.map((row) => ({
        questionSnapshotId: row.question_snapshot_id,
        textAnswer: row.text_answer,
        selectedAnswerSnapshotIds: row.selected_answer_snapshot_ids,
        textProvided: row.text_answer !== undefined,
        selectionsProvided: row.selected_answer_snapshot_ids !== undefined,
      })),
    );
  }

  @Post(':id/submit')
  submit(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.submit(req.user, id);
  }

  @Post(':id/abandon-if-empty')
  abandonIfEmpty(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.abandonIfEmpty(req.user, id);
  }

  @Get(':id/result')
  result(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.sessions.getResult(req.user, id);
  }
}
