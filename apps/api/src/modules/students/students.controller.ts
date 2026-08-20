import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.studentsService.findAll(user);
  }

  /**
   * Active students with lesson_balance <= 2.
   * Must be declared before @Get(':id').
   */
  @Get('low-balance')
  @Roles('admin')
  findLowBalance() {
    return this.studentsService.findLowBalance();
  }

  /**
   * Students for the Payments picker.
   * Admin: all school students. Teacher: assigned students.
   * Never filtered by who created the card.
   * Must be declared before @Get(':id') — otherwise Nest treats the path
   * as a student id and PostgreSQL throws on invalid UUID (HTTP 500).
   */
  @Get('payment-options')
  @Roles('admin', 'teacher')
  findPaymentOptions(@CurrentUser() user: JwtPayload) {
    return this.studentsService.findPaymentOptions(user);
  }

  @Get(':id')
  findById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studentsService.findById(user, id);
  }

  @Post()
  @Roles('admin', 'teacher')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(user, dto);
  }

  @Post('filter')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.studentsService.filter(user, dto.where ?? {});
  }

  @Patch(':id')
  @Roles('admin', 'student')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.delete(id);
  }
}
