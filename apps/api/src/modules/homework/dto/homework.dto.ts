import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HomeworkItemDto {
  @IsUUID()
  question_id!: string;

  @IsOptional()
  @IsString()
  section_key?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsOptional()
  @IsString()
  passage_text?: string;
}

export class CreateHomeworkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  activity_kind?: string;

  @IsOptional()
  @IsNumber()
  pass_score_percent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkItemDto)
  items?: HomeworkItemDto[];
}

export class UpdateHomeworkDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  activity_kind?: string;

  @IsOptional()
  @IsNumber()
  pass_score_percent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkItemDto)
  items?: HomeworkItemDto[];
}

export class AssignHomeworkDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  student_ids!: string[];

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  @IsUUID()
  lesson_id?: string;
}

export class HomeworkAnswerDto {
  @IsUUID()
  question_snapshot_id!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selected_answer_snapshot_ids?: string[];

  @IsOptional()
  @IsString()
  text?: string;
}

export class SubmitHomeworkDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkAnswerDto)
  answers?: HomeworkAnswerDto[];
}

export class SaveHomeworkAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkAnswerDto)
  answers!: HomeworkAnswerDto[];
}
