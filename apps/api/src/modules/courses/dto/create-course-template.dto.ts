import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { CourseTemplateType } from '../entities/course-template.entity';

export class CreateCourseTemplateDto {
  @IsRequiredText()
  name!: string;

  /** Optional catalog tier; defaults to basic_beginner when omitted. */
  @IsOptional()
  @IsEnum(['basic_beginner', 'advanced_beginner', 'advanced'])
  courseType?: CourseTemplateType;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalLessons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
