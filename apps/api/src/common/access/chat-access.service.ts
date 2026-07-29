import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { ChatEntity } from '../../modules/chats/entities/chat.entity';
import { ChatDirectPairEntity } from '../../modules/chats/entities/chat-direct-pair.entity';
import { ChatMemberEntity } from '../../modules/chats/entities/chat-member.entity';
import { ChatKind, ChatStatus } from '../../modules/chats/enums/chat.enums';
import { ChatPrivacyService } from './chat-privacy.service';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { GroupMemberEntity } from '../../modules/groups/entities/group-member.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { TutorEntity } from '../../modules/tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../modules/tutors/entities/tutor-student.entity';
import { DomainAccessActor } from './domain-access.types';

@Injectable()
export class ChatAccessService {
  constructor(
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatDirectPairEntity) private readonly directPairRepo: Repository<ChatDirectPairEntity>,
    @InjectRepository(StudentEntity) private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity) private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity) private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity) private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(GroupMemberEntity) private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(EnrollmentEntity) private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    private readonly privacy: ChatPrivacyService,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async assertCanRead(actor: DomainAccessActor, chatId: string): Promise<ChatEntity> {
    const chat = await this.chatRepo.findOne({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (this.isAdmin(actor)) return chat;
    const membership = await this.memberRepo.exists({ where: { chatId, userId: actor.sub } });
    if (!membership) throw new ForbiddenException('Chat membership is required');
    return chat;
  }

  async assertCanWrite(actor: DomainAccessActor, chatId: string): Promise<ChatEntity> {
    const chat = await this.assertCanRead(actor, chatId);
    if (this.isAdmin(actor)) return chat;
    if (chat.kind === ChatKind.SchoolNews) throw new ForbiddenException('Only administrators can post news');
    if (chat.status === ChatStatus.Archived) throw new ForbiddenException('Archived chats are read-only');
    if (chat.kind === ChatKind.Direct) {
      await this.assertDirectPeersNotBlocked(actor.sub, chatId);
    }
    return chat;
  }

  /**
   * Creates a DM request permission check (does not create a chat).
   * @deprecated Prefer DirectChatRequestService.create — kept name for call-site migration.
   */
  async assertCanStartDirect(actor: DomainAccessActor, targetUserId: string): Promise<void> {
    return this.assertCanCreateDmRequest(actor, targetUserId);
  }

  async assertCanCreateDmRequest(actor: DomainAccessActor, targetUserId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      await this.privacy.assertNotBlocked(actor.sub, targetUserId);
      return;
    }
    await this.privacy.assertCanReceiveDmRequest(actor.sub, targetUserId);
  }

  async assertCanInviteMember(
    actor: DomainAccessActor,
    chatId: string,
    inviteeUserId: string,
  ): Promise<void> {
    await this.assertCanWrite(actor, chatId);
    await this.privacy.assertNotBlocked(actor.sub, inviteeUserId);
  }

  async directPairExists(userIdLow: string, userIdHigh: string): Promise<boolean> {
    return this.directPairRepo.exists({ where: { userIdLow, userIdHigh } });
  }

  private async assertDirectPeersNotBlocked(actorUserId: string, chatId: string): Promise<void> {
    const peers = await this.memberRepo.find({ where: { chatId } });
    for (const peer of peers) {
      if (peer.userId === actorUserId) continue;
      await this.privacy.assertNotBlocked(actorUserId, peer.userId);
    }
  }
}
