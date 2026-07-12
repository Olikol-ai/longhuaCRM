import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateCourseTemplateDto } from './dto/create-course-template.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateCourseTemplateDto } from './dto/update-course-template.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAllTemplates(@CurrentUser() user: JwtPayload) {
    return this.coursesService.findAllTemplates(user);
  }

  @Post('filter')
  filterTemplates(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.coursesService.filterTemplates(user, dto.where ?? {});
  }

  @Get('enrollments')
  findAllEnrollments(@CurrentUser() user: JwtPayload) {
    return this.coursesService.findAllEnrollments(user);
  }

  @Get('enrollments/:id/progress')
  getEnrollmentProgress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.coursesService.getEnrollmentProgress(user, id);
  }

  @Get('enrollments/:id')
  findEnrollmentById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.coursesService.findEnrollmentById(user, id);
  }

  @Post('enrollments/filter')
  filterEnrollments(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.coursesService.filterEnrollments(user, dto.where ?? {});
  }

  @Post('enrollments')
  @Roles('admin')
  createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.coursesService.createEnrollment(dto);
  }

  @Patch('enrollments/:id')
  @Roles('admin')
  updateEnrollment(@Param('id') id: string, @Body() dto: UpdateEnrollmentDto) {
    return this.coursesService.updateEnrollment(id, dto);
  }

  @Delete('enrollments/:id')
  @Roles('admin')
  deleteEnrollment(@Param('id') id: string) {
    return this.coursesService.deleteEnrollment(id);
  }

  @Get(':id')
  findTemplateById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.coursesService.findTemplateById(user, id);
  }

  @Post()
  @Roles('admin')
  createTemplate(@Body() dto: CreateCourseTemplateDto) {
    return this.coursesService.createTemplate(dto);
  }

  @Patch(':id')
  @Roles('admin')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateCourseTemplateDto) {
    return this.coursesService.updateTemplate(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  deleteTemplate(@Param('id') id: string) {
    return this.coursesService.deleteTemplate(id);
  }
}
