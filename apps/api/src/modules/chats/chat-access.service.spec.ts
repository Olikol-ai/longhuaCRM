import { ForbiddenException } from '@nestjs/common';
import { ChatAccessService } from '../../common/access/chat-access.service';
import { ChatKind, ChatStatus } from './enums/chat.enums';

type MockRepo = { findOne: jest.Mock; exists: jest.Mock; createQueryBuilder: jest.Mock };

function repo(): MockRepo {
  return {
    findOne: jest.fn(),
    exists: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn(),
    })),
  };
}

function privacyMock() {
  return {
    assertNotBlocked: jest.fn().mockResolvedValue(undefined),
    assertCanReceiveDmRequest: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ChatAccessService', () => {
  it('delegates DM request permission to ChatPrivacyService', async () => {
    const chats = repo();
    const members = repo();
    const pairs = repo();
    const students = repo();
    const teachers = repo();
    const tutors = repo();
    const tutorStudents = repo();
    const groups = repo();
    const enrollments = repo();
    const privacy = privacyMock();
    const service = new ChatAccessService(
      chats as never,
      members as never,
      pairs as never,
      students as never,
      teachers as never,
      tutors as never,
      tutorStudents as never,
      groups as never,
      enrollments as never,
      privacy as never,
    );
    await expect(
      service.assertCanCreateDmRequest(
        { sub: 'teacher-user', email: 'teacher@example.test', role: 'teacher' },
        'student-user',
      ),
    ).resolves.toBeUndefined();
    expect(privacy.assertCanReceiveDmRequest).toHaveBeenCalledWith(
      'teacher-user',
      'student-user',
    );
  });

  it('denies school news writes to non-admin members', async () => {
    const chats = repo();
    const members = repo();
    const other = repo();
    const privacy = privacyMock();
    chats.findOne.mockResolvedValue({
      id: 'chat',
      kind: ChatKind.SchoolNews,
      status: ChatStatus.Active,
    });
    members.exists.mockResolvedValue(true);
    const service = new ChatAccessService(
      chats as never,
      members as never,
      other as never,
      other as never,
      other as never,
      other as never,
      other as never,
      other as never,
      other as never,
      privacy as never,
    );
    await expect(
      service.assertCanWrite(
        { sub: 'member', email: 'member@example.test', role: 'student' },
        'chat',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
