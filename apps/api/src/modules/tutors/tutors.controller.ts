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
import { CreateTutorMaterialDto } from './dto/create-tutor-material.dto';
import { CreateTutorStudentNotebookDto } from './dto/create-tutor-student-notebook.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { UpdateTutorMaterialDto } from './dto/update-tutor-material.dto';
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

  /** Admin (or owning tutor) creates a notebook entry for this tutor. */
  @Post(':id/students')
  @Roles('admin', 'tutor')
  createStudentForTutor(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateTutorStudentNotebookDto,
  ) {
    return this.tutorsService.createNotebookStudent(user, dto, id);
  }

  @Patch(':id/students/:studentId')
  @Roles('admin', 'tutor')
  updateStudentForTutor(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateTutorStudentNotebookDto,
  ) {
    return this.tutorsService.updateNotebookStudent(user, studentId, dto, id);
  }

  @Delete(':id/students/:studentId')
  @Roles('admin', 'tutor')
  deleteStudentForTutor(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.tutorsService.deleteNotebookStudent(user, studentId, id);
  }

  @Get(':id/materials')
  @Roles('admin', 'tutor')
  listMaterials(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorsService.listMaterials(user, id);
  }

  @Post(':id/materials')
  @Roles('admin', 'tutor')
  createMaterial(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateTutorMaterialDto,
  ) {
    return this.tutorsService.createMaterial(user, id, dto);
  }

  @Patch(':id/materials/:materialId')
  @Roles('admin', 'tutor')
  updateMaterial(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('materialId') materialId: string,
    @Body() dto: UpdateTutorMaterialDto,
  ) {
    return this.tutorsService.updateMaterial(user, id, materialId, dto);
  }

  @Delete(':id/materials/:materialId')
  @Roles('admin', 'tutor')
  deleteMaterial(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('materialId') materialId: string,
  ) {
    return this.tutorsService.deleteMaterial(user, id, materialId);
  }

  @Get(':id/lessons')
  @Roles('admin', 'tutor')
  lessons(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorsService.listLessons(user, id);
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
