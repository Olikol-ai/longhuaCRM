import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { GroupEntity } from '../../modules/groups/entities/group.entity';
import { GroupMemberEntity } from '../../modules/groups/entities/group-member.entity';
import {
  AssessmentAttemptEntity,
  AssessmentExamAssignmentEntity,
  AssessmentExamEntity,
  AssessmentResultEntity,
} from '../../modules/assessment/entities';
import { AssignmentTargetType, ContentLifecycleStatus } from '../../modules/assessment/enums';
import type { AssessmentActorKind } from '../../modules/assessment/types/assessment.types';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { DomainAccessActor } from './domain-access.types';

/**
 * Assessment ACL boundary.
 * Admin: full access. Teacher: own exams + assigned students. Student: own assignments/attempts/results.
 */
@Injectable()
export class AssessmentAccessService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(AssessmentExamEntity)
    private readonly examRepo: Repository<AssessmentExamEntity>,
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignmentRepo: Repository<AssessmentExamAssignmentEntity>,
    @InjectRepository(AssessmentAttemptEntity)
    private readonly attemptRepo: Repository<AssessmentAttemptEntity>,
    @InjectRepository(AssessmentResultEntity)
    private readonly resultRepo: Repository<AssessmentResultEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  isTeacher(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'teacher';
  }

  isTutor(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'tutor';
  }

  isStudent(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'student';
  }

  resolveActorKind(actor: DomainAccessActor): AssessmentActorKind {
    const role = normalizeRole(actor.role);
    if (role === 'admin') return 'admin';
    if (role === 'teacher') return 'teacher';
    if (role === 'tutor') return 'tutor';
    if (role === 'student') return 'student';
    return 'none';
  }

  async resolveStudentId(actor: DomainAccessActor): Promise<string | null> {
    const row = await this.studentRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  async resolveTeacherId(actor: DomainAccessActor): Promise<string | null> {
    const row = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  assertCanManageContent(actor: DomainAccessActor): void {
    if (this.isAdmin(actor) || this.isTeacher(actor) || this.isTutor(actor)) {
      return;
    }
    throw new ForbiddenException('Forbidden: cannot manage assessment content');
  }

  canManageCreatedContent(
    actor: DomainAccessActor,
    row: { createdByUserId: string | null },
  ): boolean {
    if (this.isAdmin(actor)) {
      return true;
    }
    if ((this.isTeacher(actor) || this.isTutor(actor)) && row.createdByUserId) {
      return row.createdByUserId === actor.sub;
    }
    return false;
  }

  assertCanManageCreatedContent(
    actor: DomainAccessActor,
    row: { createdByUserId: string | null },
    label = 'resource',
  ): void {
    if (this.canManageCreatedContent(actor, row)) {
      return;
    }
    throw new ForbiddenException(`Forbidden: cannot access this ${label}`);
  }

  /**
   * Question mutate (update/publish/archive/attachments/delete): admin or author.
   */
  assertCanMutateQuestion(
    actor: DomainAccessActor,
    question: { createdByUserId: string | null },
  ): void {
    this.assertCanDeleteQuestion(actor, question);
  }

  /**
   * Question delete: admin or the user who created the question.
   */
  assertCanDeleteQuestion(
    actor: DomainAccessActor,
    question: { createdByUserId: string | null },
  ): void {
    if (this.isAdmin(actor)) {
      return;
    }
    if (this.canManageCreatedContent(actor, question)) {
      return;
    }
    throw new ForbiddenException('Forbidden');
  }

  // ─── Exam ───────────────────────────────────────────────────────────────

  async assertCanReadExam(actor: DomainAccessActor, examId: string): Promise<AssessmentExamEntity> {
    const exam = await this.requireExam(examId);
    if (this.isAdmin(actor)) {
      return exam;
    }
    // HSK Academy self-serve materializations (legacy exam_academy + ECP exam_content).
    if (this.isAcademySelfServeExam(exam) && exam.createdByUserId === actor.sub) {
      return exam;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      // Published school exams are listable/assignable by instructors.
      if (
        exam.source === 'assessment' &&
        exam.status === ContentLifecycleStatus.Published
      ) {
        return exam;
      }
      if (await this.teacherCanAccessExam(actor, exam)) {
        return exam;
      }
      if (this.canManageCreatedContent(actor, exam)) {
        return exam;
      }
      throw new ForbiddenException('Forbidden: cannot access this Exam');
    }
    if (this.isStudent(actor)) {
      if (exam.status !== ContentLifecycleStatus.Published) {
        throw new ForbiddenException('Forbidden: exam is not available');
      }
      if (await this.studentHasAssignmentForExam(actor, exam.id)) {
        return exam;
      }
      throw new ForbiddenException('Forbidden: exam is not assigned to you');
    }
    throw new ForbiddenException('Forbidden');
  }

  async assertCanManageExam(actor: DomainAccessActor, examId: string): Promise<AssessmentExamEntity> {
    const exam = await this.requireExam(examId);
    if (this.isAdmin(actor)) {
      return exam;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      if (this.canManageCreatedContent(actor, exam)) {
        return exam;
      }
      throw new ForbiddenException('Forbidden: cannot edit another Exam');
    }
    throw new ForbiddenException('Forbidden: cannot manage Exam');
  }

  async filterReadableExams(
    actor: DomainAccessActor,
    exams: AssessmentExamEntity[],
  ): Promise<AssessmentExamEntity[]> {
    if (this.isAdmin(actor)) {
      return exams;
    }
    const out: AssessmentExamEntity[] = [];
    for (const exam of exams) {
      try {
        await this.assertCanReadExam(actor, exam.id);
        out.push(exam);
      } catch {
        // skip
      }
    }
    return out;
  }

  // ─── Assignment ─────────────────────────────────────────────────────────

  async assertCanReadAssignment(
    actor: DomainAccessActor,
    assignmentId: string,
  ): Promise<AssessmentExamAssignmentEntity> {
    const assignment = await this.requireAssignment(assignmentId);
    if (this.isAdmin(actor)) {
      return assignment;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      if (await this.teacherCanAccessAssignment(actor, assignment)) {
        return assignment;
      }
      throw new ForbiddenException('Forbidden: cannot access this Assignment');
    }
    if (this.isStudent(actor)) {
      if (await this.studentMatchesAssignment(actor, assignment)) {
        return assignment;
      }
      throw new ForbiddenException('Forbidden: cannot access foreign Assignment');
    }
    throw new ForbiddenException('Forbidden');
  }

  async assertCanManageAssignment(
    actor: DomainAccessActor,
    assignmentId: string,
  ): Promise<AssessmentExamAssignmentEntity> {
    const assignment = await this.requireAssignment(assignmentId);
    if (this.isAdmin(actor)) {
      return assignment;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      const exam = await this.requireExam(assignment.examId);
      if (
        exam.createdByUserId === actor.sub ||
        assignment.assignedByUserId === actor.sub
      ) {
        return assignment;
      }
      throw new ForbiddenException('Forbidden: cannot manage this Assignment');
    }
    throw new ForbiddenException('Forbidden: cannot manage Assignment');
  }

  /**
   * Create assignment ACL.
   * Admin: any published exam + any valid target.
   * Teacher/tutor: published (or own) school exam + only own students/groups.
   * Student: never.
   */
  async assertCanCreateAssignment(
    actor: DomainAccessActor,
    examId: string,
    targetType: AssignmentTargetType,
    targetId: string,
  ): Promise<void> {
    if (this.isStudent(actor)) {
      throw new ForbiddenException('Forbidden: students cannot assign exams');
    }
    this.assertCanManageContent(actor);

    const exam = await this.requireExam(examId);
    if (this.isAdmin(actor)) {
      await this.assertCanAssignTarget(actor, targetType, targetId);
      return;
    }

    if (!(this.isTeacher(actor) || this.isTutor(actor))) {
      throw new ForbiddenException('Forbidden: cannot create Assignment');
    }

    const ownsExam = this.canManageCreatedContent(actor, exam);
    const publishedSchool =
      exam.source === 'assessment' &&
      exam.status === ContentLifecycleStatus.Published;
    if (!ownsExam && !publishedSchool) {
      throw new ForbiddenException('Forbidden: cannot assign this Exam');
    }

    await this.assertCanAssignTarget(actor, targetType, targetId);
  }

  /**
   * Target must belong to the instructor via canonical CRM links.
   * Teacher → Student.assignedTeacherId / Group.teacherId.
   */
  async assertCanAssignTarget(
    actor: DomainAccessActor,
    targetType: AssignmentTargetType,
    targetId: string,
  ): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    if (!(this.isTeacher(actor) || this.isTutor(actor))) {
      throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
    }

    const teacherId = await this.resolveTeacherId(actor);

    if (targetType === AssignmentTargetType.Student) {
      if (!teacherId) {
        throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
      }
      const student = await this.studentRepo.findOne({ where: { id: targetId } });
      if (!student || student.assignedTeacherId !== teacherId) {
        throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
      }
      return;
    }

    if (
      targetType === AssignmentTargetType.Group ||
      targetType === AssignmentTargetType.CorporateGroup
    ) {
      if (!teacherId) {
        throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
      }
      const group = await this.groupRepo.findOne({ where: { id: targetId } });
      if (!group || group.teacherId !== teacherId) {
        throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
      }
      return;
    }

    if (
      targetType === AssignmentTargetType.Teacher &&
      teacherId &&
      targetId === teacherId
    ) {
      return;
    }

    throw new ForbiddenException('Вы не можете назначить экзамен этому ученику');
  }

  async filterReadableAssignments(
    actor: DomainAccessActor,
    rows: AssessmentExamAssignmentEntity[],
  ): Promise<AssessmentExamAssignmentEntity[]> {
    if (this.isAdmin(actor)) {
      return rows;
    }
    const out: AssessmentExamAssignmentEntity[] = [];
    for (const row of rows) {
      try {
        await this.assertCanReadAssignment(actor, row.id);
        out.push(row);
      } catch {
        // skip
      }
    }
    return out;
  }

  // ─── Attempt ────────────────────────────────────────────────────────────

  async assertCanStartAttempt(
    actor: DomainAccessActor,
    examId: string,
    assignmentId?: string | null,
  ): Promise<void> {
    const exam = await this.requireExam(examId);

    // HSK Academy self-serve / staff QA: no CRM Assessment assignment required.
    // Covers legacy `exam_academy` and ECP-backed `exam_content` materializations.
    if (this.isAcademySelfServeExam(exam)) {
      if (this.isAdmin(actor) || exam.createdByUserId === actor.sub) {
        return;
      }
    }

    if (this.isAdmin(actor)) {
      throw new ForbiddenException('Forbidden: admin cannot start Attempt in v1');
    }

    await this.assertCanReadExam(actor, examId);

    if (this.isAcademySelfServeExam(exam) && exam.createdByUserId === actor.sub) {
      return;
    }

    if (assignmentId) {
      const assignment = await this.assertCanReadAssignment(actor, assignmentId);
      if (assignment.examId !== examId) {
        throw new ForbiddenException('Forbidden: Assignment does not belong to Exam');
      }
    } else if (this.isStudent(actor)) {
      // Starting without assignment still requires an accessible assignment for the exam
      if (!(await this.studentHasAssignmentForExam(actor, examId))) {
        throw new ForbiddenException('Forbidden: no Assignment for this Exam');
      }
    } else if (this.isTeacher(actor) || this.isTutor(actor)) {
      const teacherId = await this.resolveTeacherId(actor);
      if (!teacherId) {
        throw new ForbiddenException('Forbidden: teacher profile required');
      }
      const selfAssignment = await this.assignmentRepo.findOne({
        where: {
          examId,
          targetType: AssignmentTargetType.Teacher,
          targetId: teacherId,
        },
      });
      if (!selfAssignment) {
        throw new ForbiddenException('Forbidden: exam is not assigned to you');
      }
    }
  }

  async assertCanAccessAttempt(
    actor: DomainAccessActor,
    attemptId: string,
  ): Promise<AssessmentAttemptEntity> {
    const attempt = await this.requireAttempt(attemptId);
    if (this.isAdmin(actor)) {
      return attempt;
    }
    if (attempt.userId === actor.sub) {
      return attempt;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      if (await this.teacherCanAccessAttempt(actor, attempt)) {
        return attempt;
      }
      throw new ForbiddenException('Forbidden: cannot access foreign Attempt');
    }
    throw new ForbiddenException('Forbidden: cannot access foreign Attempt');
  }

  async assertCanMutateAttempt(
    actor: DomainAccessActor,
    attemptId: string,
  ): Promise<AssessmentAttemptEntity> {
    const attempt = await this.requireAttempt(attemptId);
    if (this.isAdmin(actor)) {
      return attempt;
    }
    if (attempt.userId !== actor.sub) {
      throw new ForbiddenException('Forbidden: cannot modify foreign Attempt');
    }
    return attempt;
  }

  async filterReadableAttempts(
    actor: DomainAccessActor,
    rows: AssessmentAttemptEntity[],
  ): Promise<AssessmentAttemptEntity[]> {
    if (this.isAdmin(actor)) {
      return rows;
    }
    if (this.isStudent(actor)) {
      return rows.filter((row) => row.userId === actor.sub);
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      const out: AssessmentAttemptEntity[] = [];
      for (const row of rows) {
        if (row.userId === actor.sub || (await this.teacherCanAccessAttempt(actor, row))) {
          out.push(row);
        }
      }
      return out;
    }
    return [];
  }

  // ─── Result ─────────────────────────────────────────────────────────────

  async assertCanReadResult(
    actor: DomainAccessActor,
    resultId: string,
  ): Promise<AssessmentResultEntity> {
    const result = await this.requireResult(resultId);
    if (this.isAdmin(actor)) {
      return result;
    }
    const attempt = await this.requireAttempt(result.attemptId);
    if (attempt.userId === actor.sub) {
      return result;
    }
    if (this.isTeacher(actor) || this.isTutor(actor)) {
      if (await this.teacherCanAccessAttempt(actor, attempt)) {
        return result;
      }
      throw new ForbiddenException('Forbidden: cannot access another teacher Result');
    }
    throw new ForbiddenException('Forbidden: cannot access foreign Result');
  }

  async assertCanViewResults(actor: DomainAccessActor, attemptId: string): Promise<void> {
    await this.assertCanAccessAttempt(actor, attemptId);
  }

  async filterReadableResults(
    actor: DomainAccessActor,
    rows: AssessmentResultEntity[],
  ): Promise<AssessmentResultEntity[]> {
    if (this.isAdmin(actor)) {
      return rows;
    }
    const out: AssessmentResultEntity[] = [];
    for (const row of rows) {
      try {
        await this.assertCanReadResult(actor, row.id);
        out.push(row);
      } catch {
        // skip
      }
    }
    return out;
  }

  async assertCanTakeExam(actor: DomainAccessActor, examId: string): Promise<void> {
    await this.assertCanStartAttempt(actor, examId, null);
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  /**
   * Exams materialized by HSK Academy sessions (self-serve practice/mock).
   * After ECP cutover the source is `exam_content`; older rows use `exam_academy`.
   */
  private isAcademySelfServeExam(exam: { source?: string | null }): boolean {
    return exam.source === 'exam_academy' || exam.source === 'exam_content';
  }

  private async requireExam(examId: string): Promise<AssessmentExamEntity> {
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  private async requireAssignment(
    assignmentId: string,
  ): Promise<AssessmentExamAssignmentEntity> {
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  private async requireAttempt(attemptId: string): Promise<AssessmentAttemptEntity> {
    const attempt = await this.attemptRepo.findOne({ where: { id: attemptId } });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    return attempt;
  }

  private async requireResult(resultId: string): Promise<AssessmentResultEntity> {
    const result = await this.resultRepo.findOne({ where: { id: resultId } });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    return result;
  }

  private async teacherCanAccessExam(
    actor: DomainAccessActor,
    exam: AssessmentExamEntity,
  ): Promise<boolean> {
    if (exam.createdByUserId === actor.sub) {
      return true;
    }
    const teacherId = await this.resolveTeacherId(actor);
    if (!teacherId) {
      return false;
    }
    // Assigned to teacher as participant
    const selfTarget = await this.assignmentRepo.findOne({
      where: {
        examId: exam.id,
        targetType: AssignmentTargetType.Teacher,
        targetId: teacherId,
      },
    });
    if (selfTarget) {
      return true;
    }
    // Has assignment targeting one of their students / groups
    const assignments = await this.assignmentRepo.find({ where: { examId: exam.id } });
    for (const assignment of assignments) {
      if (await this.teacherCanAccessAssignment(actor, assignment)) {
        return true;
      }
    }
    return false;
  }

  private async teacherCanAccessAssignment(
    actor: DomainAccessActor,
    assignment: AssessmentExamAssignmentEntity,
  ): Promise<boolean> {
    if (assignment.assignedByUserId === actor.sub) {
      return true;
    }
    const exam = await this.examRepo.findOne({ where: { id: assignment.examId } });
    if (exam?.createdByUserId === actor.sub) {
      return true;
    }

    const teacherId = await this.resolveTeacherId(actor);
    if (!teacherId) {
      return false;
    }

    if (
      assignment.targetType === AssignmentTargetType.Teacher &&
      assignment.targetId === teacherId
    ) {
      return true;
    }

    if (assignment.targetType === AssignmentTargetType.Student) {
      const student = await this.studentRepo.findOne({
        where: { id: assignment.targetId },
      });
      return Boolean(student && student.assignedTeacherId === teacherId);
    }

    if (
      assignment.targetType === AssignmentTargetType.Group ||
      assignment.targetType === AssignmentTargetType.CorporateGroup
    ) {
      const group = await this.groupRepo.findOne({ where: { id: assignment.targetId } });
      return Boolean(group && group.teacherId === teacherId);
    }

    return false;
  }

  private async teacherCanAccessAttempt(
    actor: DomainAccessActor,
    attempt: AssessmentAttemptEntity,
  ): Promise<boolean> {
    const exam = await this.examRepo.findOne({ where: { id: attempt.examId } });
    if (exam?.createdByUserId === actor.sub) {
      return true;
    }

    if (attempt.assignmentId) {
      const assignment = await this.assignmentRepo.findOne({
        where: { id: attempt.assignmentId },
      });
      if (assignment && (await this.teacherCanAccessAssignment(actor, assignment))) {
        return true;
      }
    }

    const teacherId = await this.resolveTeacherId(actor);
    if (!teacherId) {
      return false;
    }
    if (attempt.teacherId === teacherId) {
      return true;
    }
    if (attempt.studentId) {
      const student = await this.studentRepo.findOne({
        where: { id: attempt.studentId },
      });
      if (student?.assignedTeacherId === teacherId) {
        return true;
      }
    }
    return false;
  }

  private async studentHasAssignmentForExam(
    actor: DomainAccessActor,
    examId: string,
  ): Promise<boolean> {
    const assignments = await this.assignmentRepo.find({ where: { examId } });
    for (const assignment of assignments) {
      if (await this.studentMatchesAssignment(actor, assignment)) {
        return true;
      }
    }
    return false;
  }

  private async studentMatchesAssignment(
    actor: DomainAccessActor,
    assignment: AssessmentExamAssignmentEntity,
  ): Promise<boolean> {
    const studentId = await this.resolveStudentId(actor);
    if (!studentId) {
      return false;
    }

    switch (assignment.targetType) {
      case AssignmentTargetType.Student:
        return assignment.targetId === studentId;
      case AssignmentTargetType.Public:
        return true;
      case AssignmentTargetType.Group:
      case AssignmentTargetType.CorporateGroup: {
        const member = await this.groupMemberRepo.findOne({
          where: { groupId: assignment.targetId, studentId },
        });
        return Boolean(member);
      }
      case AssignmentTargetType.Course: {
        const enrollment = await this.enrollmentRepo.findOne({
          where: { courseTemplateId: assignment.targetId, studentId },
        });
        return Boolean(enrollment);
      }
      case AssignmentTargetType.Teacher:
        return false;
      default:
        return false;
    }
  }
}
