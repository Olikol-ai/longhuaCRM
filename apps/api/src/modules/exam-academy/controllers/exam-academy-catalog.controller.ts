import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ExamAcademyCatalogService } from '../services/exam-academy-catalog.service';

/** HSK Academy catalog — Longhua school only (not tutors / tutor_students). */
@Controller('exam-academy/catalog')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'teacher', 'student')
export class ExamAcademyCatalogController {
  constructor(private readonly catalog: ExamAcademyCatalogService) {}

  @Get('programs')
  listPrograms() {
    return this.catalog.listPrograms();
  }

  @Get('versions')
  listVersions(@Query('program') program?: string) {
    return this.catalog.listVersions(program);
  }

  @Get('levels')
  listLevels(@Query('version') version: string) {
    return this.catalog.listLevels(version || 'hsk_2_0');
  }

  @Get('levels/:levelId/sections')
  getSections(@Param('levelId') levelId: string) {
    return this.catalog.getLevelSections(levelId);
  }

  @Get('levels/:levelId/blueprints')
  listBlueprints(@Param('levelId') levelId: string) {
    return this.catalog.listBlueprints(levelId);
  }

  @Get('item-types')
  listItemTypes() {
    return this.catalog.listItemTypes();
  }
}
