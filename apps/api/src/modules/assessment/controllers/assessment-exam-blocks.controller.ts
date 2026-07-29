import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import {
  CreateExamBlockDto,
  ListExamBlocksQueryDto,
  UpdateExamBlockDto,
  paginateArray,
} from '../dto';
import { ExamBlockService } from '../services/exam-block.service';

@ApiTags('Assessment Exam Blocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/blocks')
export class AssessmentExamBlocksController {
  constructor(private readonly blocks: ExamBlockService) {}

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create exam block' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamBlockDto) {
    return this.blocks.create(user, {
      name: dto.name,
      description: dto.description,
      levelLabel: dto.level_label,
      durationMinutes: dto.duration_minutes,
      questionIds: dto.question_ids,
      createdByUserId: user.sub,
    });
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'List exam blocks' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListExamBlocksQueryDto,
  ) {
    const items = await this.blocks.listForActor(user, query.status);
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':blockId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Get exam block' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.blocks.getForActor(user, blockId);
  }

  @Patch(':blockId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Update draft exam block' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: UpdateExamBlockDto,
  ) {
    return this.blocks.update(user, blockId, {
      name: dto.name,
      description: dto.description,
      levelLabel: dto.level_label,
      durationMinutes: dto.duration_minutes,
      questionIds: dto.question_ids,
    });
  }

  @Post(':blockId/publish')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Publish exam block (ACTIVE)' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.blocks.publish(user, blockId);
  }

  @Post(':blockId/archive')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Archive exam block' })
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.blocks.archive(user, blockId);
  }

  @Delete(':blockId')
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete unused block or archive if used',
  })
  @ApiResponse({ status: 200, description: 'Deleted or archived' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.blocks.deleteOrArchive(user, blockId);
  }
}
