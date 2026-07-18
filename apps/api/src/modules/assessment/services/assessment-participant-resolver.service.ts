import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../../common/constants/roles';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';

export type ResolvedParticipantIds = {
  studentId: string | null;
  teacherId: string | null;
};

@Injectable()
export class AssessmentParticipantResolver {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async resolveParticipantIds(user: {
    sub: string;
    role: string;
  }): Promise<ResolvedParticipantIds> {
    const role = normalizeRole(user.role);

    if (role === 'student') {
      const student = await this.studentRepo.findOne({ where: { userId: user.sub } });
      if (!student) {
        throw new ForbiddenException('Student profile not found for this user');
      }
      return { studentId: student.id, teacherId: null };
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: user.sub } });
      if (!teacher) {
        throw new ForbiddenException('Teacher profile not found for this user');
      }
      return { studentId: null, teacherId: teacher.id };
    }

    throw new ForbiddenException('Only students and teachers can participate in attempts');
  }
}
