import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { EnrollmentEntity } from '../../courses/entities/enrollment.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';
import {
  ChatEntity,
  ChatDirectPairEntity,
  ChatMemberEntity,
  CourseSubjectEntity,
  SubjectEntity,
  TeacherSubjectEntity,
  TutorSubjectEntity,
  UserSubjectEntity,
} from '../entities';
import { ChatKind, ChatMemberRole, ChatStatus } from '../enums/chat.enums';
import { subjectChatTitle } from '../utils/subject-chat-title';

@Injectable()
export class ChatMembershipSyncService {
  constructor(
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatDirectPairEntity) private readonly directPairRepo: Repository<ChatDirectPairEntity>,
    @InjectRepository(SubjectEntity) private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(UserSubjectEntity) private readonly userSubjectRepo: Repository<UserSubjectEntity>,
    @InjectRepository(CourseSubjectEntity) private readonly courseSubjectRepo: Repository<CourseSubjectEntity>,
    @InjectRepository(TeacherSubjectEntity)
    private readonly teacherSubjectRepo: Repository<TeacherSubjectEntity>,
    @InjectRepository(TutorSubjectEntity)
    private readonly tutorSubjectRepo: Repository<TutorSubjectEntity>,
    @InjectRepository(StudentEntity) private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity) private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity) private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseTemplateRepo: Repository<CourseTemplateEntity>,
  ) {}

  async ensureForUser(userId: string): Promise<void> {
    await this.ensureSchoolChatsMembership(userId);
    await this.syncSubjectChatsForUser(userId);
  }

  async ensureSchoolChatsMembership(userId: string): Promise<void> {
    const chats = await this.chatRepo.find({
      where: [{ kind: ChatKind.SchoolNews }, { kind: ChatKind.SchoolCommunity }],
    });
    await Promise.all(chats.map((chat) => this.addMember(chat.id, userId)));
  }

  /**
   * Recompute subject entitlements for a user and sync SUBJECT chat membership.
   * Manual admin assigns are preserved; derived links are refreshed.
   */
  async syncSubjectChatsForUser(userId: string): Promise<string[]> {
    const derived = await this.resolveDerivedSubjectIds(userId);
    const existing = await this.userSubjectRepo.find({ where: { userId } });
    const manualIds = existing
      .filter((row) => row.source === 'manual')
      .map((row) => row.subjectId);
    const desired = new Set<string>([...derived, ...manualIds]);

    for (const row of existing) {
      if (row.source === 'manual') continue;
      if (!derived.has(row.subjectId)) {
        await this.userSubjectRepo.delete({ id: row.id });
      }
    }
    for (const subjectId of derived) {
      const row = existing.find((item) => item.subjectId === subjectId);
      if (!row) {
        await this.userSubjectRepo.save({ userId, subjectId, source: 'derived' });
      }
    }

    for (const subjectId of desired) {
      await this.ensureSubjectChatMembership(userId, subjectId);
    }

    const subjectChats = await this.chatRepo.find({ where: { kind: ChatKind.Subject } });
    for (const chat of subjectChats) {
      if (!chat.subjectId || desired.has(chat.subjectId)) continue;
      await this.memberRepo.delete({ chatId: chat.id, userId });
    }

    return [...desired];
  }

  async syncSubjectChatsForStudent(studentId: string): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (student?.userId) {
      await this.syncSubjectChatsForUser(student.userId);
    }
  }

  async syncSubjectChatsForTeacher(teacherId: string): Promise<void> {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (teacher?.userId) {
      await this.syncSubjectChatsForUser(teacher.userId);
    }
    const students = await this.studentRepo.find({ where: { assignedTeacherId: teacherId } });
    await Promise.all(
      students
        .filter((row) => row.userId)
        .map((row) => this.syncSubjectChatsForUser(row.userId as string)),
    );
  }

  async syncSubjectChatsForTutor(tutorId: string): Promise<void> {
    const tutor = await this.tutorRepo.findOne({ where: { id: tutorId } });
    if (tutor?.userId) {
      await this.syncSubjectChatsForUser(tutor.userId);
    }
    const schoolStudents = await this.studentRepo.find({ where: { assignedTutorId: tutorId } });
    await Promise.all(
      schoolStudents
        .filter((row) => row.userId)
        .map((row) => this.syncSubjectChatsForUser(row.userId as string)),
    );
    const tutorStudents = await this.tutorStudentRepo.find({ where: { tutorId } });
    await Promise.all(
      tutorStudents
        .filter((row) => row.userId && row.status !== 'inactive')
        .map((row) => this.syncSubjectChatsForUser(row.userId as string)),
    );
  }

  async syncAfterEnrollment(enrollment: EnrollmentEntity): Promise<void> {
    await this.ensureCourseChatForEnrollment(enrollment);
    if (!enrollment.studentId) return;
    await this.syncSubjectChatsForStudent(enrollment.studentId);
  }

  /**
   * Subjects the user is entitled to from CRM learning/teaching links
   * (excludes manual admin assigns).
   */
  async resolveDerivedSubjectIds(userId: string): Promise<Set<string>> {
    const ids = new Set<string>();

    const teacher = await this.teacherRepo.findOne({ where: { userId } });
    if (teacher) {
      const rows = await this.teacherSubjectRepo.find({ where: { teacherId: teacher.id } });
      rows.forEach((row) => ids.add(row.subjectId));
    }

    const tutor = await this.tutorRepo.findOne({ where: { userId } });
    if (tutor) {
      const rows = await this.tutorSubjectRepo.find({ where: { tutorId: tutor.id } });
      rows.forEach((row) => ids.add(row.subjectId));
    }

    const student = await this.studentRepo.findOne({ where: { userId } });
    if (student && student.status !== 'inactive') {
      const enrollments = await this.enrollmentRepo.find({
        where: { studentId: student.id, status: In(['active', 'paused'] as const) },
      });
      const courseIds = enrollments
        .map((row) => row.courseTemplateId)
        .filter((id): id is string => Boolean(id));
      if (courseIds.length) {
        const courseSubjects = await this.courseSubjectRepo.find({
          where: { courseTemplateId: In(courseIds) },
        });
        courseSubjects.forEach((row) => ids.add(row.subjectId));
      }
      if (student.assignedTeacherId) {
        const teacherSubjects = await this.teacherSubjectRepo.find({
          where: { teacherId: student.assignedTeacherId },
        });
        teacherSubjects.forEach((row) => ids.add(row.subjectId));
      }
      if (student.assignedTutorId) {
        const tutorSubjects = await this.tutorSubjectRepo.find({
          where: { tutorId: student.assignedTutorId },
        });
        tutorSubjects.forEach((row) => ids.add(row.subjectId));
      }
    }

    const tutorStudent = await this.tutorStudentRepo.findOne({ where: { userId } });
    if (tutorStudent && tutorStudent.status !== 'inactive') {
      const tutorSubjects = await this.tutorSubjectRepo.find({
        where: { tutorId: tutorStudent.tutorId },
      });
      tutorSubjects.forEach((row) => ids.add(row.subjectId));
    }

    // Only keep active subjects
    if (ids.size === 0) return ids;
    const active = await this.subjectRepo.find({
      where: { id: In([...ids]), isActive: true },
    });
    return new Set(active.map((row) => row.id));
  }

  async ensureSubjectChat(subjectId: string): Promise<ChatEntity> {
    let chat = await this.chatRepo.findOne({ where: { kind: ChatKind.Subject, subjectId } });
    const subject = await this.subjectRepo.findOneOrFail({ where: { id: subjectId } });
    const title = subjectChatTitle(subject.name);
    if (!chat) {
      chat = await this.chatRepo.save({
        kind: ChatKind.Subject,
        subjectId,
        title,
        description: 'Системный чат предмета',
        status: subject.isActive ? ChatStatus.Active : ChatStatus.Archived,
        createdByUserId: null,
      });
    } else if (chat.title !== title) {
      chat.title = title;
      chat = await this.chatRepo.save(chat);
    }
    return chat;
  }

  async ensureSubjectChatMembership(userId: string, subjectId: string): Promise<ChatEntity> {
    const chat = await this.ensureSubjectChat(subjectId);
    await this.addMember(chat.id, userId);
    return chat;
  }

  async setTeacherSubjects(teacherId: string, subjectIds: string[]): Promise<void> {
    const unique = [...new Set(subjectIds)];
    await this.teacherSubjectRepo.delete({ teacherId });
    if (unique.length) {
      await this.teacherSubjectRepo.save(
        unique.map((subjectId) => ({ teacherId, subjectId })),
      );
    }
    await this.syncSubjectChatsForTeacher(teacherId);
  }

  async setTutorSubjects(tutorId: string, subjectIds: string[]): Promise<void> {
    const unique = [...new Set(subjectIds)];
    await this.tutorSubjectRepo.delete({ tutorId });
    if (unique.length) {
      await this.tutorSubjectRepo.save(unique.map((subjectId) => ({ tutorId, subjectId })));
    }
    await this.syncSubjectChatsForTutor(tutorId);
  }

  /** Default Longhua teaching subject for new teachers/tutors without explicit subjects. */
  async assignDefaultTeachingSubject(
    entityId: string,
    kind: 'teacher' | 'tutor',
  ): Promise<void> {
    const chinese = await this.subjectRepo.findOne({ where: { slug: 'chinese', isActive: true } });
    if (!chinese) {
      if (kind === 'teacher') await this.syncSubjectChatsForTeacher(entityId);
      else await this.syncSubjectChatsForTutor(entityId);
      return;
    }
    if (kind === 'teacher') {
      await this.setTeacherSubjects(entityId, [chinese.id]);
    } else {
      await this.setTutorSubjects(entityId, [chinese.id]);
    }
  }

  async assignDefaultCourseSubject(courseTemplateId: string): Promise<void> {
    const existing = await this.courseSubjectRepo.exists({ where: { courseTemplateId } });
    if (existing) return;
    const chinese = await this.subjectRepo.findOne({ where: { slug: 'chinese', isActive: true } });
    if (!chinese) return;
    await this.setCourseSubjects(courseTemplateId, [chinese.id]);
  }

  async setCourseSubjects(courseTemplateId: string, subjectIds: string[]): Promise<void> {
    const unique = [...new Set(subjectIds)];
    await this.courseSubjectRepo.delete({ courseTemplateId });
    if (unique.length) {
      await this.courseSubjectRepo.save(
        unique.map((subjectId) => ({ courseTemplateId, subjectId })),
      );
    }
    const enrollments = await this.enrollmentRepo.find({
      where: { courseTemplateId, status: In(['active', 'paused'] as const) },
    });
    const studentIds = [
      ...new Set(
        enrollments
          .map((row) => row.studentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    await Promise.all(studentIds.map((id) => this.syncSubjectChatsForStudent(id)));
    await this.ensureCourseChat(courseTemplateId);
  }

  async assignManualUserSubject(userId: string, subjectId: string): Promise<UserSubjectEntity> {
    let row = await this.userSubjectRepo.findOne({ where: { userId, subjectId } });
    if (!row) {
      row = await this.userSubjectRepo.save({ userId, subjectId, source: 'manual' });
    } else if (row.source !== 'manual') {
      row.source = 'manual';
      row = await this.userSubjectRepo.save(row);
    }
    await this.ensureSubjectChatMembership(userId, subjectId);
    return row;
  }

  async unassignManualUserSubject(userId: string, subjectId: string): Promise<void> {
    await this.userSubjectRepo.delete({ userId, subjectId, source: 'manual' });
    await this.syncSubjectChatsForUser(userId);
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
    return chat;
  }

  async addMember(
    chatId: string,
    userId: string,
    role: ChatMemberRole = ChatMemberRole.Member,
  ): Promise<ChatMemberEntity> {
    const existing = await this.memberRepo.findOne({ where: { chatId, userId } });
    if (existing) {
      if (existing.hiddenAt) {
        existing.hiddenAt = null;
        return this.memberRepo.save(existing);
      }
      return existing;
    }
    return this.memberRepo.save({
      chatId,
      userId,
      role,
      lastReadMessageId: null,
      mutedUntil: null,
      hiddenAt: null,
    });
  }

  async createGroup(
    title: string,
    ownerUserId: string,
    memberUserIds: string[],
    description: string | null = null,
  ): Promise<ChatEntity> {
    const safeTitle = String(title || '').trim() || 'Группа';
    // Messenger groups must never be confused with video-lesson chats.
    if (safeTitle.startsWith('Урок:') || /^Чат урока /i.test(String(description || ''))) {
      throw new BadRequestException('Lesson chats cannot be created via group chat API');
    }
    const chat = await this.chatRepo.save({
      kind: ChatKind.Group,
      title: safeTitle,
      description,
      status: ChatStatus.Active,
      createdByUserId: ownerUserId,
      subjectId: null,
      courseTemplateId: null,
      lessonId: null,
    });
    await this.addMember(chat.id, ownerUserId, ChatMemberRole.Owner);
    await Promise.all(
      [...new Set(memberUserIds)]
        .filter((id) => id !== ownerUserId)
        .map((id) => this.addMember(chat.id, id)),
    );
    return chat;
  }

  async findOrCreateDirect(firstUserId: string, secondUserId: string): Promise<ChatEntity> {
    const [userIdLow, userIdHigh] = [firstUserId, secondUserId].sort();
    const existing = await this.directPairRepo.findOne({
      where: { userIdLow, userIdHigh },
      relations: { chat: true },
    });
    if (existing?.chat) return existing.chat;
    const chat = await this.chatRepo.save({
      kind: ChatKind.Direct,
      title: '',
      description: null,
      status: ChatStatus.Active,
      createdByUserId: firstUserId,
      subjectId: null,
      courseTemplateId: null,
    });
    await this.directPairRepo.save({ userIdLow, userIdHigh, chatId: chat.id });
    await Promise.all([
      this.addMember(chat.id, firstUserId),
      this.addMember(chat.id, secondUserId),
    ]);
    return chat;
  }
}
