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
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
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

  @Get()
  @Roles('admin', 'tutor')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.tutorsService.findAll(user);
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
