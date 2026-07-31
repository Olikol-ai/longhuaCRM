import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ChatAttachmentKind, ChatMessageType } from '../enums/chat.enums';

export class CreateGroupChatDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  memberUserIds!: string[];
}

export class CreateDirectChatDto {
  @IsUUID('4')
  userId!: string;
}

export class CreateDmRequestDto {
  @Transform(({ obj }) => obj.toUserId ?? obj.to_user_id)
  @IsUUID('4')
  toUserId!: string;

  @Transform(({ obj }) => {
    const raw = obj.message;
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : undefined;
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @Length(1, 500)
  message?: string;
}

export class UpdateDmPrivacyDto {
  @IsString()
  dmPolicy!: string;
}

export class CreateBlockDto {
  @IsUUID('4')
  blockedUserId!: string;
}

export class ListDmRequestsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class InviteMembersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  memberUserIds!: string[];
}

export class CreateMessageDto {
  /** Plaintext for non-Direct chats. Forbidden for Direct text. */
  @IsOptional()
  @IsString()
  @Length(1, 10000)
  body?: string;

  /** E2EE Direct text payload (base64). */
  @IsOptional()
  @IsString()
  @Length(1, 100000)
  ciphertext?: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  nonce?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  algorithm?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  keyVersion?: number;

  @IsOptional()
  @IsUUID('4')
  replyToMessageId?: string;
}

export class CreateEncryptedMessageDto {
  @IsString()
  @Length(1, 100000)
  ciphertext!: string;

  @IsString()
  @Length(1, 256)
  nonce!: string;

  @IsString()
  @Length(1, 64)
  algorithm!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  keyVersion!: number;

  @IsOptional()
  @IsUUID('4')
  replyToMessageId?: string;
}

export class CreateCrmCardDto {
  @IsEnum(ChatMessageType)
  type!: ChatMessageType;

  @IsString()
  @Length(1, 32)
  refEntityType!: string;

  @IsUUID('4')
  refEntityId!: string;
}

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  @Length(1, 10000)
  body?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100000)
  ciphertext?: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  nonce?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  algorithm?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  keyVersion?: number;
}

export class UpsertUserCryptoDto {
  @IsString()
  @Length(1, 8192)
  publicKey!: string;

  @IsString()
  @Length(1, 8192)
  wrappedPrivateKey!: string;

  @IsString()
  @Length(1, 512)
  wrapSalt!: string;

  @IsString()
  @Length(1, 512)
  wrapIv!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  algorithm?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  kdf?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100000)
  kdfIterations?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  keyVersion?: number;
}

export class ActivateUserCryptoDto {
  @IsString()
  @Length(6, 200)
  password!: string;
}

export class MarkReadDto {
  @IsUUID('4')
  messageId!: string;
}

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  /** Cursor: message UUID (preferred) or ISO datetime (legacy). */
  @IsOptional()
  @IsString()
  before?: string;
}

export class UpdateChatProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  spokenLanguage?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  levelLabel?: string;
}

export class ChatDirectoryQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UploadAttachmentDto {
  @IsOptional()
  @IsEnum(ChatAttachmentKind)
  kind?: ChatAttachmentKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600000)
  durationMs?: number;
}

export class CreateSubjectDto {
  @IsString()
  @Length(1, 255)
  name!: string;

  @IsString()
  @Length(1, 64)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignUserSubjectDto {
  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  subjectId!: string;
}
