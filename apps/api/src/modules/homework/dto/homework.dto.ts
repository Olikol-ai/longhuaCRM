import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../../assessment/enums';

export class HomeworkItemAnswerDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsBoolean()
  is_correct!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class HomeworkItemDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @MinLength(1)
  stem!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  section_key?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsString()
  passage_text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkItemAnswerDto)
  answers?: HomeworkItemAnswerDto[];
}

export class HomeworkTaskDto {
  @IsEnum(['question', 'listening', 'reading'])
  task_kind!: 'question' | 'listening' | 'reading';

  @IsOptional()
  @IsUUID()
  question_id?: string;

  @IsOptional()
  @IsUUID()
  content_task_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkTaskDto)
  tasks?: HomeworkTaskDto[];
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeworkTaskDto)
  tasks?: HomeworkTaskDto[];
}

export class AssignHomeworkDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  student_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tutor_student_ids?: string[];

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  @IsUUID()
  lesson_id?: string;
}

export class UpdateLocalHomeworkStatusDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  result?: string;
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
