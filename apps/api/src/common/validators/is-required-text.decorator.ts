import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Required non-whitespace string for Create* DTOs.
 */
export function IsRequiredText(): PropertyDecorator {
  return applyDecorators(IsString(), IsNotEmpty(), MinLength(1));
}
