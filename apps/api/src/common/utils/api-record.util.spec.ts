import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Readable } from 'stream';
import { ApiSerializeInterceptor } from '../interceptors/api-serialize.interceptor';
import { entityToApiRecord } from './api-record.util';

describe('entityToApiRecord regression', () => {
  it('maps User-like entity to snake_case and hides secrets', () => {
    const record = entityToApiRecord({
      id: 'u1',
      email: 'a@test.local',
      passwordHash: 'secret',
      verificationCodeHash: 'hash',
      firstName: 'Ann',
      lastName: 'Lee',
      telegramId: 'tg-1',
      emailVerified: true,
      createdDate: new Date('2026-01-02T03:04:05.000Z'),
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 'u1',
      email: 'a@test.local',
      first_name: 'Ann',
      last_name: 'Lee',
      telegram_id: 'tg-1',
      email_verified: true,
      created_date: '2026-01-02T03:04:05.000Z',
    });
    expect(record.passwordHash).toBeUndefined();
    expect(record.password_hash).toBeUndefined();
    expect(record.verificationCodeHash).toBeUndefined();
    expect(record.firstName).toBeUndefined();
  });

  it('maps Student-like entity with assigned_teacher alias', () => {
    const record = entityToApiRecord({
      id: 's1',
      name: 'Student',
      assignedTeacherId: 't1',
      userId: 'u1',
      lessonBalance: 5,
      assignedTeacher: { id: 't1', name: 'hidden' },
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 's1',
      name: 'Student',
      assigned_teacher: 't1',
      user_id: 'u1',
      lesson_balance: 5,
    });
    expect(record.assignedTeacher).toBeUndefined();
    expect(record.assigned_teacher_id).toBeUndefined();
  });

  it('maps Teacher-like entity', () => {
    const record = entityToApiRecord({
      id: 't1',
      firstName: 'Tea',
      lastName: 'Cher',
      hourlyRate: 40,
      userId: 'u2',
      telegramId: '99',
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 't1',
      first_name: 'Tea',
      last_name: 'Cher',
      hourly_rate: 40,
      user_id: 'u2',
      telegram_id: '99',
    });
  });

  it('maps Lesson-like entity, formats clock times, duplicates student_id', () => {
    const record = entityToApiRecord({
      id: 'l1',
      teacherId: 't1',
      primaryStudentId: 's1',
      groupId: null,
      seriesId: 'ser1',
      startTime: '09:30:00',
      date: '2026-07-21',
      teacher: { id: 't1' },
      primaryStudent: { id: 's1' },
      group: { id: 'g1' },
      series: { id: 'ser1' },
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 'l1',
      teacher_id: 't1',
      primary_student_id: 's1',
      student_id: 's1',
      group_id: null,
      series_id: 'ser1',
      start_time: '09:30',
      date: '2026-07-21',
    });
    expect(record.teacher).toBeUndefined();
    expect(record.primary_student).toBeUndefined();
    expect(record.group).toBeUndefined();
    expect(record.series).toBeUndefined();
  });

  it('keeps intentional workspace.group / workspace.series payload fields', () => {
    const record = entityToApiRecord({
      group: {
        id: 'g1',
        name: 'HSK A',
        teacherId: 't1',
        status: 'active',
      },
      members: [{ id: 'm1', groupId: 'g1', studentId: 's1' }],
      series: [{ id: 'ser1', groupId: 'g1', status: 'active' }],
      activeSeries: null,
      lessons: [],
    }) as Record<string, unknown>;

    expect(record.group).toMatchObject({
      id: 'g1',
      name: 'HSK A',
      teacher_id: 't1',
      status: 'active',
    });
    expect(record.series).toEqual([
      { id: 'ser1', group_id: 'g1', status: 'active' },
    ]);
    expect(record.active_series).toBeNull();
    expect(record.members).toEqual([
      { id: 'm1', group_id: 'g1', student_id: 's1' },
    ]);
  });

  it('maps Payment-like entity', () => {
    const record = entityToApiRecord({
      id: 'p1',
      studentId: 's1',
      shopItemId: 'si1',
      paymentDate: new Date('2026-07-01T10:00:00.000Z'),
      lessonsAdded: 8,
      amount: 100,
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 'p1',
      student_id: 's1',
      shop_item_id: 'si1',
      payment_date: '2026-07-01T10:00:00.000Z',
      lessons_added: 8,
      amount: 100,
    });
  });

  it('maps Certificate-like entity', () => {
    const record = entityToApiRecord({
      id: 'c1',
      studentId: 's1',
      registrationNumber: 'LH-001',
      issuedAt: new Date('2026-06-01T00:00:00.000Z'),
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      id: 'c1',
      student_id: 's1',
      registration_number: 'LH-001',
      issued_at: '2026-06-01T00:00:00.000Z',
    });
  });

  it('does not serialize StreamableFile into JSON options/stream', () => {
    const file = new StreamableFile(Readable.from(Buffer.from('%PDF-1.4')), {
      type: 'application/pdf',
      disposition: 'inline; filename="a.pdf"',
    });
    const mapped = entityToApiRecord(file);
    expect(mapped).toBe(file);
    expect(mapped).toBeInstanceOf(StreamableFile);
  });

  it('does not serialize Buffer', () => {
    const buf = Buffer.from([1, 2, 3]);
    expect(entityToApiRecord(buf)).toBe(buf);
  });
});

describe('ApiSerializeInterceptor regression', () => {
  const interceptor = new ApiSerializeInterceptor();
  const context = {} as ExecutionContext;

  async function runThrough(data: unknown): Promise<unknown> {
    const next: CallHandler = { handle: () => of(data) };
    return lastValueFrom(interceptor.intercept(context, next));
  }

  it('keeps StreamableFile intact for download endpoints', async () => {
    const file = new StreamableFile(Readable.from(Buffer.from('%PDF')), {
      type: 'application/pdf',
      disposition: 'inline; filename="m.pdf"',
    });
    const out = await runThrough(file);
    expect(out).toBe(file);
    expect(out).toBeInstanceOf(StreamableFile);
  });

  it('keeps Buffer intact', async () => {
    const buf = Buffer.from('pdf-bytes');
    expect(await runThrough(buf)).toBe(buf);
  });

  it('still snake_cases ordinary API payloads', async () => {
    const out = (await runThrough({
      userId: 'u1',
      passwordHash: 'x',
      firstName: 'A',
    })) as Record<string, unknown>;

    expect(out).toEqual({
      user_id: 'u1',
      first_name: 'A',
    });
  });
});
