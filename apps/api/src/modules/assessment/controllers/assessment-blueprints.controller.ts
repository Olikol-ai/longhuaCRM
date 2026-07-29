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
  BlueprintPreviewDto,
  CreateBlueprintDto,
  ListBlueprintsQueryDto,
  UpdateBlueprintDto,
  paginateArray,
} from '../dto';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { BlueprintService } from '../services/blueprint.service';

@ApiTags('Assessment Blueprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/blueprints')
export class AssessmentBlueprintsController {
  constructor(
    private readonly blueprints: BlueprintService,
    private readonly guard: AssessmentContentGuard,
  ) {}

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create blueprint' })
  @ApiResponse({ status: 201, description: 'Blueprint created' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlueprintDto) {
    return this.blueprints.create(user, {
      examTemplateId: dto.exam_template_id,
      bankId: dto.bank_id,
      name: dto.name,
      sectionRules: dto.section_rules?.map((rule) => ({
        sectionKey: rule.section_key,
        title: rule.title,
        questionCount: rule.question_count,
        questionTypes: rule.question_types,
        difficultyMin: rule.difficulty_min,
        difficultyMax: rule.difficulty_max,
        topicIds: rule.topic_ids,
        weight: rule.weight,
      })),
      createdByUserId: user.sub,
    });
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'List blueprints' })
  @ApiResponse({ status: 200, description: 'Paginated blueprint list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListBlueprintsQueryDto) {
    let items = await this.blueprints.listForActor(user, query.status);
    if (query.exam_template_id) {
      items = items.filter((row) => row.examTemplateId === query.exam_template_id);
    }
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':blueprintId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Get blueprint detail' })
  @ApiResponse({ status: 200, description: 'Blueprint detail' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
  ) {
    return this.blueprints.getForActor(user, blueprintId);
  }

  @Patch(':blueprintId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Update draft blueprint' })
  @ApiResponse({ status: 200, description: 'Blueprint updated' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
    @Body() dto: UpdateBlueprintDto,
  ) {
    return this.blueprints.update(user, blueprintId, {
      name: dto.name,
      sectionRules: dto.section_rules?.map((rule) => ({
        sectionKey: rule.section_key,
        title: rule.title,
        questionCount: rule.question_count,
        questionTypes: rule.question_types,
        difficultyMin: rule.difficulty_min,
        difficultyMax: rule.difficulty_max,
        topicIds: rule.topic_ids,
        weight: rule.weight,
      })),
    });
  }

  @Delete(':blueprintId')
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft blueprint' })
  @ApiResponse({ status: 204, description: 'Blueprint deleted' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
  ) {
    await this.blueprints.deleteDraft(user, blueprintId);
  }

  @Post(':blueprintId/publish')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Publish blueprint' })
  @ApiResponse({ status: 200, description: 'Blueprint published' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
  ) {
    return this.blueprints.publish(user, blueprintId);
  }

  @Post(':blueprintId/archive')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Archive blueprint' })
  @ApiResponse({ status: 200, description: 'Blueprint archived' })
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
  ) {
    return this.blueprints.archive(user, blueprintId);
  }

  @Post(':blueprintId/preview')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Preview blueprint question generation' })
  @ApiResponse({ status: 200, description: 'Blueprint preview result' })
  preview(
    @CurrentUser() user: JwtPayload,
    @Param('blueprintId', ParseUUIDPipe) blueprintId: string,
    @Body() dto: BlueprintPreviewDto,
  ) {
    return this.blueprints.preview(user, blueprintId, dto.seed);
  }
}
