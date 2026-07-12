import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GroupEntity } from './entities/group.entity';
import { GroupMemberEntity } from './entities/group-member.entity';

@Injectable()
export class GroupsRepository {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly memberRepo: Repository<GroupMemberEntity>,
  ) {}

  findAll(): Promise<GroupEntity[]> {
    return this.groupRepo.find();
  }

  findById(id: string): Promise<GroupEntity | null> {
    return this.groupRepo.findOne({ where: { id } });
  }

  save(entity: Partial<GroupEntity>): Promise<GroupEntity> {
    return this.groupRepo.save(this.groupRepo.create(entity));
  }

  async update(id: string, data: Partial<GroupEntity>): Promise<GroupEntity | null> {
    await this.groupRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.groupRepo.delete({ id });
  }

  filter(where: FindOptionsWhere<GroupEntity>): Promise<GroupEntity[]> {
    return this.groupRepo.find({ where });
  }

  findMembersByGroupId(groupId: string): Promise<GroupMemberEntity[]> {
    return this.memberRepo.find({ where: { groupId } });
  }

  findMemberById(id: string): Promise<GroupMemberEntity | null> {
    return this.memberRepo.findOne({ where: { id } });
  }

  saveMember(entity: Partial<GroupMemberEntity>): Promise<GroupMemberEntity> {
    return this.memberRepo.save(this.memberRepo.create(entity));
  }

  async deleteMember(id: string): Promise<void> {
    await this.memberRepo.delete({ id });
  }

  filterMembers(where: FindOptionsWhere<GroupMemberEntity>): Promise<GroupMemberEntity[]> {
    return this.memberRepo.find({ where });
  }
}
