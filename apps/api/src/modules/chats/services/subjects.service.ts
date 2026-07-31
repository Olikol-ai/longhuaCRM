import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChatEntity,
  ChatMemberEntity,
  CourseSubjectEntity,
  SubjectEntity,
  TeacherSubjectEntity,
  TutorSubjectEntity,
  UserSubjectEntity,
} from '../entities';
import { ChatKind, ChatStatus } from '../enums/chat.enums';
import { CreateSubjectDto, UpdateSubjectDto } from '../dto/chats.dto';
import { ChatMembershipSyncService } from './chat-membership-sync.service';
import { subjectChatTitle } from '../utils/subject-chat-title';

export type SubjectAdminView = SubjectEntity & {
  chatId: string | null;
  chatTitle: string | null;
  memberCount: number;
  memberUserIds: string[];
  teacherIds: string[];
  tutorIds: string[];
  courseTemplateIds: string[];
};

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(SubjectEntity) private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(UserSubjectEntity) private readonly userSubjectRepo: Repository<UserSubjectEntity>,
    @InjectRepository(TeacherSubjectEntity)
    private readonly teacherSubjectRepo: Repository<TeacherSubjectEntity>,
    @InjectRepository(TutorSubjectEntity)
    private readonly tutorSubjectRepo: Repository<TutorSubjectEntity>,
    @InjectRepository(CourseSubjectEntity)
    private readonly courseSubjectRepo: Repository<CourseSubjectEntity>,
    private readonly membershipSync: ChatMembershipSyncService,
  ) {}

  list(): Promise<SubjectEntity[]> {
    return this.subjectRepo.find({ order: { name: 'ASC' } });
  }

  async listAdmin(): Promise<SubjectAdminView[]> {
    const subjects = await this.subjectRepo.find({ order: { name: 'ASC' } });
    return Promise.all(subjects.map((subject) => this.toAdminView(subject)));
  }

  async getAdmin(id: string): Promise<SubjectAdminView> {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.toAdminView(subject);
  }

  async create(dto: CreateSubjectDto): Promise<SubjectAdminView> {
    const slug = dto.slug.trim().toLowerCase();
    const exists = await this.subjectRepo.exists({ where: { slug } });
    if (exists) throw new ConflictException('Subject slug already exists');
    const subject = await this.subjectRepo.save({
      name: dto.name.trim(),
      slug,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    await this.membershipSync.ensureSubjectChat(subject.id);
    return this.toAdminView(subject);
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectAdminView> {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (dto.name !== undefined) subject.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      const clash = await this.subjectRepo.findOne({ where: { slug } });
      if (clash && clash.id !== id) throw new ConflictException('Subject slug already exists');
      subject.slug = slug;
    }
    if (dto.description !== undefined) subject.description = dto.description ?? null;
    if (dto.isActive !== undefined) subject.isActive = dto.isActive;
    const saved = await this.subjectRepo.save(subject);
    const chat = await this.membershipSync.ensureSubjectChat(saved.id);
    chat.title = subjectChatTitle(saved.name);
    chat.status = saved.isActive ? ChatStatus.Active : ChatStatus.Archived;
    await this.chatRepo.save(chat);
    return this.toAdminView(saved);
  }

  async assignUser(userId: string, subjectId: string): Promise<UserSubjectEntity> {
    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.membershipSync.assignManualUserSubject(userId, subjectId);
  }

  async unassignUser(userId: string, subjectId: string): Promise<void> {
    await this.membershipSync.unassignManualUserSubject(userId, subjectId);
  }

  async setTeacherSubjects(teacherId: string, subjectIds: string[]): Promise<void> {
    await this.assertSubjectsExist(subjectIds);
    await this.membershipSync.setTeacherSubjects(teacherId, subjectIds);
  }

  async setTutorSubjects(tutorId: string, subjectIds: string[]): Promise<void> {
    await this.assertSubjectsExist(subjectIds);
    await this.membershipSync.setTutorSubjects(tutorId, subjectIds);
  }

  async setCourseSubjects(courseTemplateId: string, subjectIds: string[]): Promise<void> {
    await this.assertSubjectsExist(subjectIds);
    await this.membershipSync.setCourseSubjects(courseTemplateId, subjectIds);
  }

  async listTeacherSubjectIds(teacherId: string): Promise<string[]> {
    const rows = await this.teacherSubjectRepo.find({ where: { teacherId } });
    return rows.map((row) => row.subjectId);
  }

  async listTutorSubjectIds(tutorId: string): Promise<string[]> {
    const rows = await this.tutorSubjectRepo.find({ where: { tutorId } });
    return rows.map((row) => row.subjectId);
  }

  private async assertSubjectsExist(subjectIds: string[]): Promise<void> {
    if (!subjectIds.length) return;
    const found = await this.subjectRepo.count({ where: { id: In(subjectIds) } });
    if (found !== new Set(subjectIds).size) {
      throw new NotFoundException('One or more subjects were not found');
    }
  }

  private async toAdminView(subject: SubjectEntity): Promise<SubjectAdminView> {
    const chat = await this.chatRepo.findOne({
      where: { kind: ChatKind.Subject, subjectId: subject.id },
    });
    const members = chat
      ? await this.memberRepo.find({ where: { chatId: chat.id } })
      : [];
    const teachers = await this.teacherSubjectRepo.find({ where: { subjectId: subject.id } });
    const tutors = await this.tutorSubjectRepo.find({ where: { subjectId: subject.id } });
    const courses = await this.courseSubjectRepo.find({ where: { subjectId: subject.id } });
    return Object.assign(subject, {
      chatId: chat?.id ?? null,
      chatTitle: chat?.title ?? null,
      memberCount: members.length,
      memberUserIds: members.map((row) => row.userId),
      teacherIds: teachers.map((row) => row.teacherId),
      tutorIds: tutors.map((row) => row.tutorId),
      courseTemplateIds: courses.map((row) => row.courseTemplateId),
    });
  }
}
