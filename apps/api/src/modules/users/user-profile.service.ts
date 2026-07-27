import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatStudentProfileDisplayName } from './display-name.util';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';

export interface UserProfileSnapshot {
  studentProfileId: string | null;
  teacherProfileId: string | null;
  tutorProfileId: string | null;
  hasStudentProfile: boolean;
  hasTeacherProfile: boolean;
  hasTutorProfile: boolean;
  /** Student.name SSOT when a student profile is linked. */
  studentDisplayName: string | null;
  teacherDisplayName: string | null;
  tutorDisplayName: string | null;
}

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
  ) {}

  async resolveProfiles(userId: string): Promise<UserProfileSnapshot> {
    const [student, teacher, tutor] = await Promise.all([
      this.studentRepo.findOne({ where: { userId } }),
      this.teacherRepo.findOne({ where: { userId } }),
      this.tutorRepo.findOne({ where: { userId } }),
    ]);

    return {
      studentProfileId: student?.id ?? null,
      teacherProfileId: teacher?.id ?? null,
      tutorProfileId: tutor?.id ?? null,
      hasStudentProfile: Boolean(student),
      hasTeacherProfile: Boolean(teacher),
      hasTutorProfile: Boolean(tutor),
      studentDisplayName: student
        ? formatStudentProfileDisplayName(student) || null
        : null,
      teacherDisplayName: teacher?.name?.trim() || null,
      tutorDisplayName: tutor?.displayName?.trim() || null,
    };
  }

  toProfileFields(snapshot: UserProfileSnapshot): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      student_profile_id: snapshot.studentProfileId,
      teacher_profile_id: snapshot.teacherProfileId,
      tutor_profile_id: snapshot.tutorProfileId,
      has_student_profile: snapshot.hasStudentProfile,
      has_teacher_profile: snapshot.hasTeacherProfile,
      has_tutor_profile: snapshot.hasTutorProfile,
    };
    // Expose Student.name as `name` so FE greetings/certificates prefer SSOT.
    if (snapshot.studentDisplayName) {
      fields.name = snapshot.studentDisplayName;
    } else if (snapshot.teacherDisplayName) {
      fields.name = snapshot.teacherDisplayName;
    } else if (snapshot.tutorDisplayName) {
      fields.name = snapshot.tutorDisplayName;
    }
    return fields;
  }
}
