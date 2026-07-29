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
  CreateExamTemplateDto,
  ListExamTemplatesQueryDto,
  UpdateExamTemplateDto,
  paginateArray,
} from '../dto';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ExamTemplateService } from '../services/exam-template.service';

@ApiTags('Assessment Exam Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/exam-templates')
export class AssessmentExamTemplatesController {
  constructor(
    private readonly templates: ExamTemplateService,
    private readonly guard: AssessmentContentGuard,
  ) {}

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create exam template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamTemplateDto) {
    return this.templates.create({
      name: dto.name,
      description: dto.description ?? null,
      locale: dto.locale ?? null,
      levelLabel: dto.level_label ?? null,
      createdByUserId: user.sub,
    });
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'List exam templates' })
  @ApiResponse({ status: 200, description: 'Paginated template list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListExamTemplatesQueryDto) {
    let items = await this.templates.listForActor(user, query.status);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          (row.description?.toLowerCase().includes(needle) ?? false),
      );
    }
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':templateId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Get exam template' })
  @ApiResponse({ status: 200, description: 'Template detail' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.templates.getForActor(user, templateId);
  }

  @Patch(':templateId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Update draft exam template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateExamTemplateDto,
  ) {
    return this.templates.update(user, templateId, {
      name: dto.name,
      description: dto.description,
      locale: dto.locale,
      levelLabel: dto.level_label,
    });
  }

  @Delete(':templateId')
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft exam template' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    await this.templates.deleteDraft(user, templateId);
  }

  @Post(':templateId/publish')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Publish exam template' })
  @ApiResponse({ status: 200, description: 'Template published' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.templates.publish(user, templateId);
  }

  @Post(':templateId/archive')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Archive exam template' })
  @ApiResponse({ status: 200, description: 'Template archived' })
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.templates.archive(user, templateId);
  }
}
