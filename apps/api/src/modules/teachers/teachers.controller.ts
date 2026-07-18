import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { AvailableTeachersQueryDto } from './dto/available-teachers-query.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.teachersService.findAll(user);
  }

  /**
   * Advisory: active teachers free for date + startTime + duration.
   * Must be declared before @Get(':id') so "available" is not parsed as an id.
   */
  @Get('available')
  @Roles('admin')
  findAvailable(@Query() query: AvailableTeachersQueryDto) {
    return this.teachersService.findAvailableForSlot({
      date: query.date,
      startTime: query.startTime,
      duration: query.duration,
    });
  }

  @Get(':id')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teachersService.findById(user, id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Post('filter')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.teachersService.filter(user, dto.where ?? {});
  }

  @Patch(':id')
  @Roles('admin', 'teacher')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.teachersService.delete(id);
  }
}
