import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { LessonSeriesService } from './lesson-series.service';

@Controller('lesson-series')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonSeriesController {
  constructor(private readonly lessonSeriesService: LessonSeriesService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.lessonSeriesService.findAll();
  }

  @Post('filter')
  @Roles('admin')
  filter(@Body() dto: FilterQueryDto) {
    return this.lessonSeriesService.filter(dto.where ?? {});
  }

  @Get(':id')
  @Roles('admin')
  findById(@Param('id') id: string) {
    return this.lessonSeriesService.findById(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateLessonSeriesDto) {
    return this.lessonSeriesService.create(dto);
  }
}
