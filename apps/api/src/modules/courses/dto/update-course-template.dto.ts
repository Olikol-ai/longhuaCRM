import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CourseTemplateType } from '../entities/course-template.entity';

export class UpdateCourseTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

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
