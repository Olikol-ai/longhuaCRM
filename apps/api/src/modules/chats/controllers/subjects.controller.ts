import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  AssignUserSubjectDto,
  CreateSubjectDto,
  SetSubjectIdsDto,
  UpdateSubjectDto,
} from '../dto/chats.dto';
import { SubjectEntity, UserSubjectEntity } from '../entities';
import { SubjectAdminView, SubjectsService } from '../services/subjects.service';

@Controller('chats/subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  list(): Promise<SubjectEntity[]> {
    return this.subjectsService.list();
  }

  @Get('admin')
  @Roles('admin')
  listAdmin(): Promise<SubjectAdminView[]> {
    return this.subjectsService.listAdmin();
  }

  @Get('admin/:id')
  @Roles('admin')
  getAdmin(@Param('id', ParseUUIDPipe) id: string): Promise<SubjectAdminView> {
    return this.subjectsService.getAdmin(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateSubjectDto): Promise<SubjectAdminView> {
    return this.subjectsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ): Promise<SubjectAdminView> {
    return this.subjectsService.update(id, dto);
  }

  @Post('assign')
  @Roles('admin')
  assign(@Body() dto: AssignUserSubjectDto): Promise<UserSubjectEntity> {
    return this.subjectsService.assignUser(dto.userId, dto.subjectId);
  }

  @Delete('assign')
  @Roles('admin')
  async unassign(@Body() dto: AssignUserSubjectDto): Promise<{ ok: true }> {
    await this.subjectsService.unassignUser(dto.userId, dto.subjectId);
    return { ok: true };
  }

  @Get('teachers/:teacherId')
  @Roles('admin', 'teacher')
  listTeacherSubjects(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<string[]> {
    return this.subjectsService.listTeacherSubjectIds(teacherId);
  }

  @Put('teachers/:teacherId')
  @Roles('admin')
  async setTeacherSubjects(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: SetSubjectIdsDto,
  ): Promise<{ ok: true; subjectIds: string[] }> {
    await this.subjectsService.setTeacherSubjects(teacherId, dto.subjectIds);
    const subjectIds = await this.subjectsService.listTeacherSubjectIds(teacherId);
    return { ok: true, subjectIds };
  }

  @Get('tutors/:tutorId')
  @Roles('admin', 'tutor')
  listTutorSubjects(@Param('tutorId', ParseUUIDPipe) tutorId: string): Promise<string[]> {
    return this.subjectsService.listTutorSubjectIds(tutorId);
  }

  @Put('tutors/:tutorId')
  @Roles('admin')
  async setTutorSubjects(
    @Param('tutorId', ParseUUIDPipe) tutorId: string,
    @Body() dto: SetSubjectIdsDto,
  ): Promise<{ ok: true; subjectIds: string[] }> {
    await this.subjectsService.setTutorSubjects(tutorId, dto.subjectIds);
    const subjectIds = await this.subjectsService.listTutorSubjectIds(tutorId);
    return { ok: true, subjectIds };
  }

  @Put('courses/:courseTemplateId')
  @Roles('admin')
  async setCourseSubjects(
    @Param('courseTemplateId', ParseUUIDPipe) courseTemplateId: string,
    @Body() dto: SetSubjectIdsDto,
  ): Promise<{ ok: true }> {
    await this.subjectsService.setCourseSubjects(courseTemplateId, dto.subjectIds);
    return { ok: true };
  }
}
