import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { ExamAcademyBankService } from '../services/exam-academy-bank.service';

class OptionDto {
  @IsString()
  text!: string;

  @IsBoolean()
  is_correct!: boolean;
}

class VocabDto {
  @IsString()
  word!: string;

  @IsOptional()
  @IsString()
  pinyin?: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  explanation?: string;
}

class CreateBankItemDto {
  @IsUUID()
  version_id!: string;

  @IsUUID()
  level_id!: string;

  @IsString()
  section_key!: string;

  @IsOptional()
  @IsString()
  item_type_code?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  recommended_time_seconds?: number;

  @IsString()
  stem!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VocabDto)
  vocabulary?: VocabDto[];

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

@Controller('exam-academy/bank')
@UseGuards(AuthGuard('jwt'))
export class ExamAcademyBankController {
  constructor(private readonly bank: ExamAcademyBankService) {}

  @Get('items')
  list(
    @Req() req: { user: DomainAccessActor },
    @Query('version_id') versionId?: string,
    @Query('level_id') levelId?: string,
    @Query('section_key') sectionKey?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.bank.list(req.user, {
      versionId,
      levelId,
      sectionKey,
      status,
      search,
    });
  }

  @Get('items/:id')
  get(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.bank.get(req.user, id);
  }

  @Post('items')
  create(@Req() req: { user: DomainAccessActor }, @Body() dto: CreateBankItemDto) {
    return this.bank.create(req.user, {
      versionId: dto.version_id,
      levelId: dto.level_id,
      sectionKey: dto.section_key,
      itemTypeCode: dto.item_type_code,
      topic: dto.topic,
      difficulty: dto.difficulty,
      recommendedTimeSeconds: dto.recommended_time_seconds,
      stem: dto.stem,
      explanation: dto.explanation,
      options: dto.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      vocabulary: dto.vocabulary,
      publish: dto.publish,
    });
  }

  @Post('items/:id/publish')
  publish(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.bank.publish(req.user, id);
  }

  @Post('items/:id/archive')
  archive(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.bank.archive(req.user, id);
  }

  @Patch('items/:id')
  update(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body()
    body: {
      topic?: string | null;
      difficulty?: number;
      section_key?: string;
      recommended_time_seconds?: number | null;
      vocabulary?: VocabDto[];
    },
  ) {
    return this.bank.updateMeta(req.user, id, {
      topic: body.topic,
      difficulty: body.difficulty,
      sectionKey: body.section_key,
      recommendedTimeSeconds: body.recommended_time_seconds,
      vocabulary: body.vocabulary,
    });
  }
}
