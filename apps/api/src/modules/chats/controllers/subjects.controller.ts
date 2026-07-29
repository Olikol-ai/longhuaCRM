import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { SubjectEntity, UserSubjectEntity } from '../entities';
import { AssignUserSubjectDto, CreateSubjectDto } from '../dto/chats.dto';
import { ChatMembershipSyncService } from '../services/chat-membership-sync.service';

@Controller('chats/subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(
    @InjectRepository(SubjectEntity) private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(UserSubjectEntity) private readonly userSubjectRepo: Repository<UserSubjectEntity>,
    private readonly membershipSync: ChatMembershipSyncService,
  ) {}

  @Get() list(): Promise<SubjectEntity[]> { return this.subjectRepo.find({ order: { name: 'ASC' } }); }
  @Post() @Roles('admin') create(@Body() dto: CreateSubjectDto): Promise<SubjectEntity> { return this.subjectRepo.save({ name: dto.name, slug: dto.slug, description: dto.description ?? null }); }
  @Post('assign') @Roles('admin')
  async assign(@CurrentUser() _actor: JwtPayload, @Body() dto: AssignUserSubjectDto): Promise<UserSubjectEntity> {
    let row = await this.userSubjectRepo.findOne({ where: { userId: dto.userId, subjectId: dto.subjectId } });
    if (!row) row = await this.userSubjectRepo.save({ userId: dto.userId, subjectId: dto.subjectId });
    await this.membershipSync.ensureSubjectChatMembership(dto.userId, dto.subjectId);
    return row;
  }
}
