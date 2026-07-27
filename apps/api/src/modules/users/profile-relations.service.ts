import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { StudentDeletionService } from '../students/student-deletion.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherDeletionService } from '../teachers/teacher-deletion.service';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorDeletionService } from '../tutors/tutor-deletion.service';

export interface OrphanStudentRecord {
  id: string;
  name: string;
  email: string | null;
}

export interface ProfileDeleteResult {
  orphanStudents: OrphanStudentRecord[];
}

@Injectable()
export class ProfileRelationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly teacherDeletion: TeacherDeletionService,
    private readonly tutorDeletion: TutorDeletionService,
    private readonly studentDeletion: StudentDeletionService,
  ) {}

  async findOrphanStudents(): Promise<OrphanStudentRecord[]> {
    const rows = await this.dataSource.getRepository(StudentEntity).find({
      where: {
        assignedTeacherId: IsNull(),
        status: 'active',
      },
      order: { name: 'ASC' },
    });
    return rows.map((row) => this.toOrphanRecord(row));
  }

  async deleteStudent(studentId: string): Promise<ProfileDeleteResult> {
    await this.studentDeletion.deleteStudent(studentId);
    return { orphanStudents: await this.findOrphanStudents() };
  }

  deleteTeacher(teacherId: string): Promise<ProfileDeleteResult> {
    return this.teacherDeletion.deleteTeacher(teacherId);
  }

  async deleteTutor(tutorId: string): Promise<ProfileDeleteResult> {
    await this.tutorDeletion.deleteTutor(tutorId);
    return { orphanStudents: await this.findOrphanStudents() };
  }

  async deleteProfilesForUser(userId: string): Promise<ProfileDeleteResult> {
    const studentRepo = this.dataSource.getRepository(StudentEntity);
    const teacherRepo = this.dataSource.getRepository(TeacherEntity);
    const tutorRepo = this.dataSource.getRepository(TutorEntity);

    const [linkedStudents, linkedTeachers, linkedTutors] = await Promise.all([
      studentRepo.find({ where: { userId } }),
      teacherRepo.find({ where: { userId } }),
      tutorRepo.find({ where: { userId } }),
    ]);

    for (const teacher of linkedTeachers) {
      await this.deleteTeacher(teacher.id);
    }

    for (const tutor of linkedTutors) {
      await this.deleteTutor(tutor.id);
    }

    for (const student of linkedStudents) {
      await this.deleteStudent(student.id);
    }

    await this.dataSource.getRepository(MaterialAccessEntity).delete({ userId });

    return { orphanStudents: await this.findOrphanStudents() };
  }

  private toOrphanRecord(student: StudentEntity): OrphanStudentRecord {
    return {
      id: student.id,
      name: student.name,
      email: student.email ?? null,
    };
  }
}
