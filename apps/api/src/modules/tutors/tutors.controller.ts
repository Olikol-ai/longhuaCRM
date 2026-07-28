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
import { CreateTutorDto } from './dto/create-tutor.dto';
import { CreateTutorStudentNotebookDto } from './dto/create-tutor-student-notebook.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { UpdateTutorStudentNotebookDto } from './dto/update-tutor-student-notebook.dto';
import { TutorsService } from './tutors.service';

@Controller('tutors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('me')
  @Roles('tutor', 'admin')
  findMe(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.findMe(user);
  }

  @Get('me/stats')
  @Roles('tutor', 'admin')
  myStats(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.getStats(user);
  }

  @Get('me/students')
  @Roles('tutor', 'admin')
  myStudents(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.listStudents(user);
  }

  @Post('me/students')
  @Roles('tutor')
  createMyStudent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTutorStudentNotebookDto,
  ) {
    return this.tutorsService.createNotebookStudent(user, dto);
  }

  @Patch('me/students/:studentId')
  @Roles('tutor')
  updateMyStudent(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateTutorStudentNotebookDto,
  ) {
    return this.tutorsService.updateNotebookStudent(user, studentId, dto);
  }

  @Delete('me/students/:studentId')
  @Roles('tutor')
  deleteMyStudent(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
  ) {
    return this.tutorsService.deleteNotebookStudent(user, studentId);
  }

  /** Admin: all isolated tutor students (not school students). */
  @Get('students/all')
  @Roles('admin')
  allTutorStudents(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.listAllTutorStudents(user);
  }

  /** Admin platform-usage table for all tutors. Declared before :id. */
  @Get('analytics/overview')
  @Roles('admin')
  adminOverview() {
    return this.tutorsService.adminOverview();
  }

  @Get()
  @Roles('admin', 'tutor')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.findAll(user);
  }

  @Get(':id/students')
  @Roles('admin', 'tutor')
  students(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorsService.listStudents(user, id);
  }

  @Get(':id/stats')
  @Roles('admin', 'tutor')
  stats(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorsService.getStats(user, id);
  }

  @Get(':id')
  @Roles('admin', 'tutor')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorsService.findById(user, id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTutorDto) {
    return this.tutorsService.create(dto);
  }

  @Post('filter')
  @Roles('admin', 'tutor')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.tutorsService.filter(user, dto.where ?? {});
  }

  @Patch(':id')
  @Roles('admin', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTutorDto,
  ) {
    return this.tutorsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.tutorsService.delete(id);
  }
}
