import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { EnrollmentEntity } from '../../courses/entities/enrollment.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import {
  ChatEntity,
  ChatDirectPairEntity,
  ChatMemberEntity,
  CourseSubjectEntity,
  SubjectEntity,
  UserSubjectEntity,
} from '../entities';
import { ChatKind, ChatMemberRole, ChatStatus } from '../enums/chat.enums';

@Injectable()
export class ChatMembershipSyncService {
  constructor(
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatDirectPairEntity) private readonly directPairRepo: Repository<ChatDirectPairEntity>,
    @InjectRepository(SubjectEntity) private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(UserSubjectEntity) private readonly userSubjectRepo: Repository<UserSubjectEntity>,
    @InjectRepository(CourseSubjectEntity) private readonly courseSubjectRepo: Repository<CourseSubjectEntity>,
    @InjectRepository(StudentEntity) private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseTemplateRepo: Repository<CourseTemplateEntity>,
  ) {}

  async ensureForUser(userId: string): Promise<void> {
    await this.ensureSchoolChatsMembership(userId);
    await this.ensureChineseSubjectForStudent(userId);
    const subjects = await this.userSubjectRepo.find({ where: { userId } });
    await Promise.all(subjects.map((row) => this.ensureSubjectChatMembership(userId, row.subjectId)));
  }

  async ensureSchoolChatsMembership(userId: string): Promise<void> {
    const chats = await this.chatRepo.find({ where: [{ kind: ChatKind.SchoolNews }, { kind: ChatKind.SchoolCommunity }] });
    await Promise.all(chats.map((chat) => this.addMember(chat.id, userId)));
  }

  async ensureChineseSubjectForStudent(userId: string): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { userId } });
    if (!student) return;
    const chinese = await this.subjectRepo.findOne({ where: { slug: 'chinese' } });
    if (!chinese) return;
    if (!(await this.userSubjectRepo.exists({ where: { userId, subjectId: chinese.id } }))) {
      await this.userSubjectRepo.save({ userId, subjectId: chinese.id });
    }
  }

  async ensureSubjectChatMembership(userId: string, subjectId: string): Promise<ChatEntity> {
    let chat = await this.chatRepo.findOne({ where: { kind: ChatKind.Subject, subjectId } });
    if (!chat) {
      const subject = await this.subjectRepo.findOneOrFail({ where: { id: subjectId } });
      chat = await this.chatRepo.save({ kind: ChatKind.Subject, subjectId, title: subject.name, description: 'Системный чат предмета', status: ChatStatus.Active, createdByUserId: null });
    }
    await this.addMember(chat.id, userId);
    return chat;
  }

  async ensureCourseChatForEnrollment(enrollment: EnrollmentEntity): Promise<void> {
    if (!enrollment.courseTemplateId || !enrollment.studentId) return;
    const chat = await this.ensureCourseChat(enrollment.courseTemplateId);
    const student = await this.studentRepo.findOne({ where: { id: enrollment.studentId } });
    if (student?.userId) await this.addMember(chat.id, student.userId);
  }

  async ensureCourseChat(courseTemplateId: string): Promise<ChatEntity> {
    let chat = await this.chatRepo.findOne({ where: { kind: ChatKind.Course, courseTemplateId } });
    if (!chat) {
      const template = await this.courseTemplateRepo.findOne({ where: { id: courseTemplateId } });
      chat = await this.chatRepo.save({
        kind: ChatKind.Course,
        courseTemplateId,
        title: template?.name ? `Курс: ${template.name}` : 'Чат курса',
        description: null,
        status: ChatStatus.Active,
        createdByUserId: null,
      });
    }
    const subjects = await this.courseSubjectRepo.find({ where: { courseTemplateId } });
    for (const subject of subjects) {
      const memberships = await this.userSubjectRepo.find({ where: { subjectId: subject.subjectId } });
      await Promise.all(memberships.map((membership) => this.addMember(chat.id, membership.userId)));
    }
    return chat;
  }

  async addMember(chatId: string, userId: string, role: ChatMemberRole = ChatMemberRole.Member): Promise<ChatMemberEntity> {
    const existing = await this.memberRepo.findOne({ where: { chatId, userId } });
    return existing ?? this.memberRepo.save({ chatId, userId, role, lastReadMessageId: null, mutedUntil: null });
  }

  async createGroup(title: string, ownerUserId: string, memberUserIds: string[], description: string | null = null): Promise<ChatEntity> {
    const chat = await this.chatRepo.save({ kind: ChatKind.Group, title, description, status: ChatStatus.Active, createdByUserId: ownerUserId, subjectId: null, courseTemplateId: null });
    await this.addMember(chat.id, ownerUserId, ChatMemberRole.Owner);
    await Promise.all([...new Set(memberUserIds)].filter((id) => id !== ownerUserId).map((id) => this.addMember(chat.id, id)));
    return chat;
  }

  async findOrCreateDirect(firstUserId: string, secondUserId: string): Promise<ChatEntity> {
    const [userIdLow, userIdHigh] = [firstUserId, secondUserId].sort();
    const existing = await this.directPairRepo.findOne({ where: { userIdLow, userIdHigh }, relations: { chat: true } });
    if (existing?.chat) return existing.chat;
    const chat = await this.chatRepo.save({ kind: ChatKind.Direct, title: '', description: null, status: ChatStatus.Active, createdByUserId: firstUserId, subjectId: null, courseTemplateId: null });
    await this.directPairRepo.save({ userIdLow, userIdHigh, chatId: chat.id });
    await Promise.all([this.addMember(chat.id, firstUserId), this.addMember(chat.id, secondUserId)]);
    return chat;
  }
}
