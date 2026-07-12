import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { JwtPayload } from '../auth/auth.service';
import { GroupEntity } from './entities/group.entity';
import { GroupMemberEntity } from './entities/group-member.entity';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsRepository } from './groups.repository';

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async findAll(actor: JwtPayload): Promise<GroupEntity[]> {
    const where = await this.teacherAccess.scopeGroupFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<GroupEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<GroupEntity> {
    await this.teacherAccess.assertCanReadGroup(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    return row;
  }

  create(dto: CreateGroupDto): Promise<GroupEntity> {
    return this.repository.save(dto);
  }

  async update(id: string, dto: UpdateGroupDto): Promise<GroupEntity> {
    const row = await this.repository.update(id, dto);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    await this.repository.delete(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<GroupEntity[]> {
    const scoped = await this.teacherAccess.scopeGroupFilter(actor, where);
    return this.repository.filter(scoped as FindOptionsWhere<GroupEntity>);
  }

  async findMembers(actor: JwtPayload, groupId: string): Promise<GroupMemberEntity[]> {
    await this.teacherAccess.assertCanReadGroup(actor, groupId);
    return this.repository.findMembersByGroupId(groupId);
  }

  async addMember(groupId: string, dto: AddGroupMemberDto): Promise<GroupMemberEntity> {
    const row = await this.repository.findById(groupId);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    return this.repository.saveMember({ groupId, studentId: dto.studentId });
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    const row = await this.repository.findById(groupId);
    if (!row) {
      throw new NotFoundException('Group not found');
    }
    const member = await this.repository.findMemberById(memberId);
    if (!member || member.groupId !== groupId) {
      throw new NotFoundException('Group member not found');
    }
    await this.repository.deleteMember(memberId);
  }
}
