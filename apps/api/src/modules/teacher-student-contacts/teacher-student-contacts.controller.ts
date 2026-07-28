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
import { CreateTeacherStudentContactDto } from './dto/create-teacher-student-contact.dto';
import { UpdateTeacherStudentContactDto } from './dto/update-teacher-student-contact.dto';
import { TeacherStudentContactOwnerType } from './entities/teacher-student-contact.entity';
import { TeacherStudentContactsService } from './teacher-student-contacts.service';

@Controller('teacher-student-contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherStudentContactsController {
  constructor(private readonly contactsService: TeacherStudentContactsService) {}

  @Get('me')
  @Roles('teacher', 'tutor', 'admin')
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('ownerType') ownerType?: TeacherStudentContactOwnerType,
  ) {
    return this.contactsService.listMine(user, ownerType);
  }

  @Post('me')
  @Roles('teacher', 'tutor')
  createMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTeacherStudentContactDto,
    @Query('ownerType') ownerType?: TeacherStudentContactOwnerType,
  ) {
    return this.contactsService.create(user, dto, ownerType);
  }

  @Get(':ownerType/:ownerId')
  @Roles('admin', 'teacher', 'tutor')
  listForOwner(
    @CurrentUser() user: JwtPayload,
    @Param('ownerType') ownerType: TeacherStudentContactOwnerType,
    @Param('ownerId') ownerId: string,
  ) {
    return this.contactsService.listForOwner(user, ownerType, ownerId);
  }

  @Post(':ownerType/:ownerId')
  @Roles('admin', 'teacher', 'tutor')
  createForOwner(
    @CurrentUser() user: JwtPayload,
    @Param('ownerType') ownerType: TeacherStudentContactOwnerType,
    @Param('ownerId') ownerId: string,
    @Body() dto: CreateTeacherStudentContactDto,
  ) {
    return this.contactsService.createForOwner(user, ownerType, ownerId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherStudentContactDto,
  ) {
    return this.contactsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.contactsService.remove(user, id);
  }
}
