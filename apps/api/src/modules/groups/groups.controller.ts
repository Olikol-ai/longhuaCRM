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
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @Roles('admin', 'teacher')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.groupsService.findAll(user);
  }

  @Post('filter')
  @Roles('admin', 'teacher')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.groupsService.filter(user, dto.where ?? {});
  }

  @Get(':id/workspace')
  @Roles('admin', 'teacher')
  getWorkspace(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groupsService.getWorkspace(user, id);
  }

  @Get(':id/members')
  @Roles('admin', 'teacher')
  findMembers(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groupsService.findMembers(user, id);
  }

  @Post(':id/members')
  @Roles('admin')
  addMember(@Param('id') id: string, @Body() dto: AddGroupMemberDto) {
    return this.groupsService.addMember(id, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles('admin')
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.groupsService.removeMember(id, memberId);
  }

  @Get(':id')
  @Roles('admin', 'teacher')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groupsService.findById(user, id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.groupsService.delete(id);
  }
}
