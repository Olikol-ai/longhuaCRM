import { ForbiddenException } from '@nestjs/common';
import { ChatAccessService } from '../../common/access/chat-access.service';
import { ChatKind, ChatStatus } from './enums/chat.enums';

type MockRepo = { findOne: jest.Mock; exists: jest.Mock; createQueryBuilder: jest.Mock };

function repo(): MockRepo {
  return {
    findOne: jest.fn(),
    exists: jest.fn(),
    createQueryBuilder: jest.fn(() => ({ innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getExists: jest.fn() })),
  };
}

describe('ChatAccessService', () => {
  it('allows an assigned teacher to start a student direct chat', async () => {
    const chats = repo(); const members = repo(); const pairs = repo(); const students = repo(); const teachers = repo(); const tutors = repo(); const tutorStudents = repo(); const groups = repo(); const enrollments = repo();
    students.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'student', assignedTeacherId: 'teacher' });
    teachers.findOne.mockResolvedValueOnce({ id: 'teacher' }).mockResolvedValueOnce(null);
    tutors.findOne.mockResolvedValue(null);
    tutorStudents.findOne.mockResolvedValue(null);
    const service = new ChatAccessService(chats as never, members as never, pairs as never, students as never, teachers as never, tutors as never, tutorStudents as never, groups as never, enrollments as never);
    await expect(service.assertCanStartDirect({ sub: 'teacher-user', email: 'teacher@example.test', role: 'teacher' }, 'student-user')).resolves.toBeUndefined();
  });

  it('denies school news writes to non-admin members', async () => {
    const chats = repo(); const members = repo(); const other = repo();
    chats.findOne.mockResolvedValue({ id: 'chat', kind: ChatKind.SchoolNews, status: ChatStatus.Active });
    members.exists.mockResolvedValue(true);
    const service = new ChatAccessService(chats as never, members as never, other as never, other as never, other as never, other as never, other as never, other as never, other as never);
    await expect(service.assertCanWrite({ sub: 'member', email: 'member@example.test', role: 'student' }, 'chat')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
