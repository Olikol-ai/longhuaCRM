import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TeacherInvitesService } from './teacher-invites.service';

describe('TeacherInvitesService.ensureMine', () => {
  const teacherId = 'teacher-1';
  const actor = { sub: 'user-1', role: 'teacher' } as const;

  function buildService(inviteRepo: Record<string, unknown>) {
    const teacherAccess = {
      resolveTeacherId: jest.fn().mockResolvedValue(teacherId),
    };
    const studentRepo = {
      createQueryBuilder: jest.fn(),
    };
    return new TeacherInvitesService(
      inviteRepo as never,
      studentRepo as never,
      teacherAccess as never,
    );
  }

  it('reuses the existing non-revoked link instead of inserting another', async () => {
    const existing = {
      id: 'invite-existing',
      teacherId,
      expiresAt: new Date(Date.now() + 86_400_000),
      label: null,
      revokedAt: null,
    };
    const inviteRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(),
      create: jest.fn(),
    };
    const service = buildService(inviteRepo);

    const first = await service.ensureMine(actor as never);
    const second = await service.ensureMine(actor as never);

    expect(first.created).toBe(false);
    expect(second.created).toBe(false);
    expect(first.id).toBe('invite-existing');
    expect(second.token).toBe('invite-existing');
    expect(inviteRepo.save).not.toHaveBeenCalled();
    expect(inviteRepo.create).not.toHaveBeenCalled();
  });

  it('create() alias is idempotent and returns the same public token', async () => {
    const existing = {
      id: 'invite-existing',
      teacherId,
      expiresAt: new Date(Date.now() + 86_400_000),
      label: null,
      revokedAt: null,
    };
    const inviteRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(),
      create: jest.fn(),
    };
    const service = buildService(inviteRepo);

    const a = await service.create(actor as never);
    const b = await service.create(actor as never);
    expect(a.id).toBe(b.id);
    expect(a.token).toBe(a.id);
  });

  it('resolves registration by invite UUID and by legacy hashed token', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      teacherId,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      tokenHash: 'legacy-hash',
    };
    const inviteRepo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === row.id) return row;
        if (where.tokenHash) return row;
        return null;
      }),
    };
    const service = buildService(inviteRepo);

    const byId = await service.resolveValidInvite(row.id);
    expect(byId).toEqual({ teacherId, inviteLinkId: row.id });

    await expect(service.resolveValidInvite('revoked-looking')).resolves.toEqual({
      teacherId,
      inviteLinkId: row.id,
    });
  });

  it('rejects revoked invite UUID', async () => {
    const row = {
      id: '22222222-2222-4222-8222-222222222222',
      teacherId,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: new Date(),
    };
    const inviteRepo = {
      findOne: jest.fn().mockResolvedValue(row),
    };
    const service = buildService(inviteRepo);
    await expect(service.resolveValidInvite(row.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recovers from unique-violation race by returning the winner row', async () => {
    const winner = {
      id: 'invite-winner',
      teacherId,
      expiresAt: new Date(Date.now() + 86_400_000),
      label: null,
      revokedAt: null,
    };
    const inviteRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner),
      create: jest.fn((x) => x),
      save: jest.fn().mockRejectedValue(
        Object.assign(new QueryFailedError('INSERT', [], new Error('duplicate')), {
          driverError: { code: '23505' },
        }),
      ),
    };
    const service = buildService(inviteRepo);
    const result = await service.ensureMine(actor as never);
    expect(result.id).toBe('invite-winner');
    expect(result.created).toBe(false);
  });
});
