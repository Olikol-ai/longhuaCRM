import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentEntity } from '../../entities/student.entity';
import { TeacherEntity } from '../../entities/teacher.entity';

export interface UserProfileSnapshot {
  studentProfileId: string | null;
  teacherProfileId: string | null;
  hasStudentProfile: boolean;
  hasTeacherProfile: boolean;
}

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async resolveProfiles(userId: string): Promise<UserProfileSnapshot> {
    const [student, teacher] = await Promise.all([
      this.studentRepo.findOne({ where: { userId } }),
      this.teacherRepo.findOne({ where: { userId } }),
    ]);

    return {
      studentProfileId: student?.id ?? null,
      teacherProfileId: teacher?.id ?? null,
      hasStudentProfile: Boolean(student),
      hasTeacherProfile: Boolean(teacher),
    };
  }

  toProfileFields(snapshot: UserProfileSnapshot): Record<string, unknown> {
    return {
      student_profile_id: snapshot.studentProfileId,
      teacher_profile_id: snapshot.teacherProfileId,
      has_student_profile: snapshot.hasStudentProfile,
      has_teacher_profile: snapshot.hasTeacherProfile,
    };
  }
}
