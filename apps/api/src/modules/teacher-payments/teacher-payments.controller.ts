import {
  Body,
  Controller,
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
import { TeacherAccessService } from '../../common/access/teacher-access.service';import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateTeacherPaymentDto } from './dto/update-teacher-payment.dto';
import { TeacherPaymentsService } from './teacher-payments.service';

@Controller('teacher-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherPaymentsController {
  constructor(
    private readonly teacherPaymentsService: TeacherPaymentsService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  @Get('my')
  @Roles('admin', 'teacher')
  findMy(@CurrentUser() user: JwtPayload) {
    return this.teacherPaymentsService.findMyPayments(user);
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.teacherPaymentsService.findAll();
  }

  @Post('filter')
  @Roles('admin')
  filter(@Body() dto: FilterQueryDto) {
    return this.teacherPaymentsService.filter(dto.where ?? {});
  }

  @Get(':id')
  @Roles('admin')
  findById(@Param('id') id: string) {
    return this.teacherPaymentsService.findById(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherPaymentDto) {
    return this.teacherPaymentsService.update(id, dto);
  }
}
