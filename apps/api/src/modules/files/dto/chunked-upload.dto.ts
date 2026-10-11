import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DEFAULT_MATERIALS_MAX_UPLOAD_BYTES,
  MATERIALS_UPLOAD_MAX_CHUNKS,
} from '../material-upload.limits';

export class InitChunkedUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  originalName!: string;

  /** Declared total size; hard-capped at product MAX (5 GiB). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DEFAULT_MATERIALS_MAX_UPLOAD_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mimeType?: string;
}

export class CompleteChunkedUploadDto {
  @IsUUID('4')
  uploadId!: string;
}

export class AbortChunkedUploadDto {
  @IsUUID('4')
  uploadId!: string;
}

/** Used when reading multipart fields for chunk upload. */
export class ChunkUploadFieldsDto {
  @IsUUID('4')
  uploadId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MATERIALS_UPLOAD_MAX_CHUNKS - 1)
  chunkIndex!: number;
}
