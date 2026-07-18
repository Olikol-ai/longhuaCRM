import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AttachmentKind } from '../../enums';

export class CreateAttachmentDto {
  @ApiProperty({ enum: AttachmentKind })
  @IsEnum(AttachmentKind)
  kind!: AttachmentKind;
}
