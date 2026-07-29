import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { ChatEntity } from '../../modules/chats/entities/chat.entity';
import { ChatDirectPairEntity } from '../../modules/chats/entities/chat-direct-pair.entity';
import { ChatMemberEntity } from '../../modules/chats/entities/chat-member.entity';
import { ChatKind, ChatStatus } from '../../modules/chats/enums/chat.enums';
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
    return chat;
  }

  async assertCanStartDirect(actor: DomainAccessActor, targetUserId: string): Promise<void> {
    if (actor.sub === targetUserId || this.isAdmin(actor)) return;
    const [actorStudent, targetStudent, actorTeacher, targetTeacher, actorTutor, targetTutor] =
      await Promise.all([
        this.studentRepo.findOne({ where: { userId: actor.sub } }),
        this.studentRepo.findOne({ where: { userId: targetUserId } }),
        this.teacherRepo.findOne({ where: { userId: actor.sub } }),
        this.teacherRepo.findOne({ where: { userId: targetUserId } }),
        this.tutorRepo.findOne({ where: { userId: actor.sub } }),
        this.tutorRepo.findOne({ where: { userId: targetUserId } }),
      ]);

    if (
      (actorStudent && targetTeacher && actorStudent.assignedTeacherId === targetTeacher.id) ||
      (targetStudent && actorTeacher && targetStudent.assignedTeacherId === actorTeacher.id) ||
      (actorStudent && targetTutor && actorStudent.assignedTutorId === targetTutor.id) ||
      (targetStudent && actorTutor && targetStudent.assignedTutorId === actorTutor.id)
    ) return;

    const actorTutorStudent = await this.tutorStudentRepo.findOne({ where: { userId: actor.sub } });
    const targetTutorStudent = await this.tutorStudentRepo.findOne({ where: { userId: targetUserId } });
    if (actorTutor && targetTutorStudent) {
      const link = await this.tutorStudentRepo.exists({ where: { tutorId: actorTutor.id, userId: targetUserId } });
      if (link) return;
    }
    if (targetTutor && actorTutorStudent) {
      const link = await this.tutorStudentRepo.exists({ where: { tutorId: targetTutor.id, userId: actor.sub } });
      if (link) return;
    }
    if (actorStudent && targetStudent) {
      const sharedGroup = await this.groupMemberRepo
        .createQueryBuilder('a')
        .innerJoin(GroupMemberEntity, 'b', 'b.group_id = a.group_id')
        .where('a.student_id = :actorStudentId', { actorStudentId: actorStudent.id })
        .andWhere('b.student_id = :targetStudentId', { targetStudentId: targetStudent.id })
        .getExists();
      if (sharedGroup) return;
    }
    throw new ForbiddenException('You cannot start a direct chat with this user');
  }

  async directPairExists(userIdLow: string, userIdHigh: string): Promise<boolean> {
    return this.directPairRepo.exists({ where: { userIdLow, userIdHigh } });
  }
}
