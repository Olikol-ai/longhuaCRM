import { IsUUID } from 'class-validator';

export class MergeStudentsDto {
  @IsUUID()
  secondaryStudentId!: string;
}
