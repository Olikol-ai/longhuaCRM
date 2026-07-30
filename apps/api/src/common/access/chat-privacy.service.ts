import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { DomainAccessActor } from './domain-access.types';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { GroupMemberEntity } from '../../modules/groups/entities/group-member.entity';
import { AttendanceEntity } from '../../modules/lessons/entities/attendance.entity';
import { LessonEntity } from '../../modules/lessons/entities/lesson.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { TeacherStudentContactEntity } from '../../modules/teacher-student-contacts/entities/teacher-student-contact.entity';
import { TutorEntity } from '../../modules/tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../modules/tutors/entities/tutor-student.entity';
import { UserEntity } from '../../modules/users/entities/user.entity';
import {
  DirectChatRequestEntity,
  UserBlockEntity,
  UserPrivacySettingsEntity,
  ChatDirectPairEntity,
} from '../../modules/chats/entities';
import { DirectChatRequestStatus, DmPrivacyPolicy } from '../../modules/chats/enums/chat.enums';

const VALID_POLICIES = new Set<string>(Object.values(DmPrivacyPolicy));

@Injectable()
export class ChatPrivacyService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserPrivacySettingsEntity)
    private readonly privacyRepo: Repository<UserPrivacySettingsEntity>,
    @InjectRepository(UserBlockEntity)
    private readonly blockRepo: Repository<UserBlockEntity>,
    @InjectRepository(DirectChatRequestEntity)
    private readonly requestRepo: Repository<DirectChatRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(ChatDirectPairEntity)
    private readonly directPairRepo: Repository<ChatDirectPairEntity>,
    @InjectRepository(TeacherStudentContactEntity)
    private readonly contactRepo: Repository<TeacherStudentContactEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepo: Repository<AttendanceEntity>,
  ) {}

  private requestsPerDay(): number {
    return Number(this.config.get('CHAT_DM_REQUESTS_PER_DAY') ?? 10);
  }

  private requestsPerPair30d(): number {
    return Number(this.config.get('CHAT_DM_REQUESTS_PER_PAIR_30D') ?? 3);
  }

  private declineCooldownDays(): number {
    return Number(this.config.get('CHAT_DM_DECLINE_COOLDOWN_DAYS') ?? 7);
  }

  private requestTtlDays(): number {
    return Number(this.config.get('CHAT_DM_REQUEST_TTL_DAYS') ?? 14);
  }

  defaultPolicyForRole(role: string): DmPrivacyPolicy {
    const normalized = normalizeRole(role);
    if (normalized === 'admin') return DmPrivacyPolicy.AllRegistered;
    if (normalized === 'teacher' || normalized === 'tutor') return DmPrivacyPolicy.MyStudents;
    return DmPrivacyPolicy.MyTeachers;
  }

  async getOrCreateSettings(userId: string): Promise<UserPrivacySettingsEntity> {
    const existing = await this.privacyRepo.findOne({ where: { userId } });
    if (existing) return existing;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.privacyRepo.save({
      userId,
      dmPolicy: this.defaultPolicyForRole(user.role),
    });
  }

  async updatePolicy(actor: DomainAccessActor, policy: DmPrivacyPolicy): Promise<UserPrivacySettingsEntity> {
    if (!VALID_POLICIES.has(policy)) {
      throw new BadRequestException('Неизвестная политика приватности');
    }
    await this.getOrCreateSettings(actor.sub);
    await this.privacyRepo.update({ userId: actor.sub }, { dmPolicy: policy });
    return this.getOrCreateSettings(actor.sub);
  }

  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const count = await this.blockRepo
      .createQueryBuilder('b')
      .where(
        '(b.blocker_user_id = :a AND b.blocked_user_id = :b) OR (b.blocker_user_id = :b AND b.blocked_user_id = :a)',
        { a: userA, b: userB },
      )
      .getCount();
    return count > 0;
  }

  async assertNotBlocked(userA: string, userB: string): Promise<void> {
    if (await this.isBlockedEitherWay(userA, userB)) {
      throw new ForbiddenException('Переписка заблокирована');
    }
  }

  async listBlocks(actor: DomainAccessActor): Promise<UserBlockEntity[]> {
    return this.blockRepo.find({
      where: { blockerUserId: actor.sub },
      relations: { blockedUser: true },
      order: { createdAt: 'DESC' },
    });
  }

  async blockUser(actor: DomainAccessActor, blockedUserId: string): Promise<UserBlockEntity> {
    if (actor.sub === blockedUserId) {
      throw new BadRequestException('Нельзя заблокировать себя');
    }
    const target = await this.userRepo.findOne({ where: { id: blockedUserId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.blockRepo.findOne({
      where: { blockerUserId: actor.sub, blockedUserId },
    });
    if (existing) return existing;
    return this.blockRepo.save({ blockerUserId: actor.sub, blockedUserId });
  }

  async unblockUser(actor: DomainAccessActor, blockedUserId: string): Promise<void> {
    await this.blockRepo.delete({ blockerUserId: actor.sub, blockedUserId });
  }

  computeExpiresAt(from: Date = new Date()): Date {
    const expires = new Date(from);
    expires.setDate(expires.getDate() + this.requestTtlDays());
    return expires;
  }

  async assertCanReceiveDmRequest(fromUserId: string, toUserId: string): Promise<void> {
    const result = await this.evaluateDmEligibility(fromUserId, toUserId, {
      includeRateLimits: true,
      includePending: true,
    });
    if (result.canRequest) return;
    this.throwEligibility(result);
  }

  /**
   * Directory / soft UI check — privacy + block + pending, without rate limits.
   * Rate limits are enforced only on POST create so one exhausted quota does not
   * disable every "Отправить запрос" button in search results.
   */
  async canRequest(
    fromUserId: string,
    toUserId: string,
  ): Promise<{ canRequest: boolean; reason: string | null; code: string }> {
    return this.evaluateDmEligibility(fromUserId, toUserId, {
      includeRateLimits: false,
      includePending: true,
    });
  }

  async evaluateDmEligibility(
    fromUserId: string,
    toUserId: string,
    options: { includeRateLimits: boolean; includePending: boolean },
  ): Promise<{ canRequest: boolean; reason: string | null; code: string }> {
    if (fromUserId === toUserId) {
      return { canRequest: false, reason: 'Нельзя отправить запрос себе', code: 'self' };
    }

    if (await this.isBlockedEitherWay(fromUserId, toUserId)) {
      return {
        canRequest: false,
        reason: 'Переписка заблокирована (чёрный список)',
        code: 'blocked',
      };
    }

    const toUser = await this.userRepo.findOne({ where: { id: toUserId } });
    if (!toUser || toUser.status !== 'active') {
      return { canRequest: false, reason: 'Пользователь не найден', code: 'not_found' };
    }

    if (options.includePending) {
      const pending = await this.requestRepo.findOne({
        where: {
          fromUserId,
          toUserId,
          status: DirectChatRequestStatus.Pending,
        },
      });
      if (pending) {
        return {
          canRequest: false,
          reason: 'Запрос уже ожидает ответа',
          code: 'pending',
        };
      }
    }

    const settings = await this.getOrCreateSettings(toUserId);
    const allowed = await this.policyAllows(
      settings.dmPolicy,
      fromUserId,
      toUserId,
      toUser.role,
    );
    if (!allowed) {
      return {
        canRequest: false,
        reason: 'Пользователь не принимает запросы на переписку (настройки приватности)',
        code: 'privacy',
      };
    }

    if (options.includeRateLimits) {
      try {
        await this.assertRateLimits(fromUserId, toUserId);
      } catch (err) {
        return {
          canRequest: false,
          reason: this.httpExceptionMessage(err),
          code: err instanceof HttpException && err.getStatus() === 429 ? 'rate_limit' : 'cooldown',
        };
      }
    }

    return { canRequest: true, reason: null, code: 'ok' };
  }

  private throwEligibility(result: {
    canRequest: boolean;
    reason: string | null;
    code: string;
  }): never {
    const message = result.reason || 'Запрещено';
    if (result.code === 'not_found') {
      throw new NotFoundException(message);
    }
    if (result.code === 'self' || result.code === 'pending') {
      throw new BadRequestException(message);
    }
    if (result.code === 'rate_limit') {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new ForbiddenException(message);
  }

  private httpExceptionMessage(err: unknown): string {
    if (!(err instanceof HttpException)) {
      return 'Запрещено';
    }
    const body = err.getResponse();
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object') {
      const msg = (body as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.filter(Boolean).join(', ') || err.message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    return err.message || 'Запрещено';
  }

  private async assertRateLimits(fromUserId: string, toUserId: string): Promise<void> {
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    const createdToday = await this.requestRepo.count({
      where: { fromUserId, createdAt: MoreThan(dayAgo) },
    });
    if (createdToday >= this.requestsPerDay()) {
      throw new HttpException(
        `Лимит запросов: не более ${this.requestsPerDay()} в сутки`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const pairCount = await this.requestRepo.count({
      where: {
        fromUserId,
        toUserId,
        createdAt: MoreThan(monthAgo),
      },
    });
    if (pairCount >= this.requestsPerPair30d()) {
      throw new HttpException(
        `Лимит запросов этому пользователю: не более ${this.requestsPerPair30d()} за 30 дней`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cooldownDays = this.declineCooldownDays();
    const cooldownSince = new Date();
    cooldownSince.setDate(cooldownSince.getDate() - cooldownDays);
    const declined = await this.requestRepo.findOne({
      where: {
        fromUserId,
        toUserId,
        status: DirectChatRequestStatus.Declined,
        respondedAt: MoreThan(cooldownSince),
      },
      order: { respondedAt: 'DESC' },
    });
    if (declined) {
      throw new ForbiddenException(
        `Запрос отклонён. Повтор через ${cooldownDays} дней после отклонения`,
      );
    }
  }

  private async policyAllows(
    policy: DmPrivacyPolicy,
    fromUserId: string,
    toUserId: string,
    toRole: string,
  ): Promise<boolean> {
    if (policy === DmPrivacyPolicy.Nobody) return false;
    if (policy === DmPrivacyPolicy.AllRegistered) return true;

    const fromUser = await this.userRepo.findOne({ where: { id: fromUserId } });
    if (!fromUser) return false;
    const fromRole = normalizeRole(fromUser.role);

    if (policy === DmPrivacyPolicy.TeachersOnly) return fromRole === 'teacher';
    if (policy === DmPrivacyPolicy.TutorsOnly) return fromRole === 'tutor';

    if (policy === DmPrivacyPolicy.MyTeachers) {
      return this.isMyTeacher(toUserId, fromUserId);
    }
    if (policy === DmPrivacyPolicy.MyTutors) {
      return this.isMyTutor(toUserId, fromUserId);
    }
    if (policy === DmPrivacyPolicy.MyStudents) {
      return this.isMyStudent(toUserId, fromUserId);
    }
    if (policy === DmPrivacyPolicy.MyCourseMembers) {
      return this.shareCourse(fromUserId, toUserId);
    }
    if (policy === DmPrivacyPolicy.MyContacts) {
      return (
        (await this.hasEducationalLink(fromUserId, toUserId)) ||
        (await this.hasDirectPair(fromUserId, toUserId))
      );
    }
    void toRole;
    return false;
  }

  private async isMyTeacher(studentUserId: string, teacherUserId: string): Promise<boolean> {
    const student = await this.studentRepo.findOne({ where: { userId: studentUserId } });
    const teacher = await this.teacherRepo.findOne({ where: { userId: teacherUserId } });
    if (student && teacher && student.assignedTeacherId === teacher.id) return true;
    if (student && teacher) {
      if (
        await this.contactRepo.exists({
          where: {
            ownerType: 'teacher',
            ownerId: teacher.id,
            linkedStudentId: student.id,
            status: 'active',
          },
        })
      ) {
        return true;
      }
      if (
        await this.attendanceRepo
          .createQueryBuilder('a')
          .innerJoin(LessonEntity, 'l', 'l.id = a.lesson_id')
          .where('a.student_id = :studentId', { studentId: student.id })
          .andWhere('l.teacher_id = :teacherId', { teacherId: teacher.id })
          .getExists()
      ) {
        return true;
      }
    }
    return false;
  }

  private async isMyTutor(studentUserId: string, tutorUserId: string): Promise<boolean> {
    const student = await this.studentRepo.findOne({ where: { userId: studentUserId } });
    const tutor = await this.tutorRepo.findOne({ where: { userId: tutorUserId } });
    if (student && tutor && student.assignedTutorId === tutor.id) return true;
    if (tutor) {
      const link = await this.tutorStudentRepo.exists({
        where: { tutorId: tutor.id, userId: studentUserId },
      });
      if (link) return true;
    }
    if (student && tutor) {
      if (
        await this.contactRepo.exists({
          where: {
            ownerType: 'tutor',
            ownerId: tutor.id,
            linkedStudentId: student.id,
            status: 'active',
          },
        })
      ) {
        return true;
      }
    }
    return false;
  }

  private async isMyStudent(staffUserId: string, studentUserId: string): Promise<boolean> {
    if (await this.isMyTeacher(studentUserId, staffUserId)) return true;
    if (await this.isMyTutor(studentUserId, staffUserId)) return true;
    return false;
  }

  private async shareCourse(userA: string, userB: string): Promise<boolean> {
    const [studentA, studentB] = await Promise.all([
      this.studentRepo.findOne({ where: { userId: userA } }),
      this.studentRepo.findOne({ where: { userId: userB } }),
    ]);
    if (!studentA || !studentB) return false;
    return this.enrollmentRepo
      .createQueryBuilder('a')
      .innerJoin(EnrollmentEntity, 'b', 'b.course_template_id = a.course_template_id')
      .where('a.student_id = :a', { a: studentA.id })
      .andWhere('b.student_id = :b', { b: studentB.id })
      .getExists();
  }

  private async hasEducationalLink(userA: string, userB: string): Promise<boolean> {
    if (await this.isMyStudent(userA, userB)) return true;
    if (await this.isMyStudent(userB, userA)) return true;
    const [studentA, studentB] = await Promise.all([
      this.studentRepo.findOne({ where: { userId: userA } }),
      this.studentRepo.findOne({ where: { userId: userB } }),
    ]);
    if (studentA && studentB) {
      return this.groupMemberRepo
        .createQueryBuilder('a')
        .innerJoin(GroupMemberEntity, 'b', 'b.group_id = a.group_id')
        .where('a.student_id = :a', { a: studentA.id })
        .andWhere('b.student_id = :b', { b: studentB.id })
        .getExists();
    }
    return false;
  }

  private async hasDirectPair(userA: string, userB: string): Promise<boolean> {
    const [low, high] = [userA, userB].sort();
    return this.directPairRepo.exists({ where: { userIdLow: low, userIdHigh: high } });
  }
}
