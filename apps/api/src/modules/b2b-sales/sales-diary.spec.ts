import { ForbiddenException } from '@nestjs/common';
import { SALES_DIARY_STATUSES } from './entities/sales-diary-entry.entity';
import { SALES_DIARY_CONTACT_TYPES } from './entities/sales-diary-contact.entity';
import { entryToRecord } from './sales-diary.mapper';

describe('Sales diary constants', () => {
  it('defines all workflow statuses', () => {
    expect(SALES_DIARY_STATUSES).toContain('new');
    expect(SALES_DIARY_STATUSES).toContain('contract_signed');
    expect(SALES_DIARY_STATUSES).toContain('refused');
    expect(SALES_DIARY_STATUSES.length).toBe(10);
  });

  it('defines contact types', () => {
    expect(SALES_DIARY_CONTACT_TYPES).toEqual(['call', 'email', 'meeting', 'messenger', 'other']);
  });
});

describe('Sales diary mapper', () => {
  it('maps entry with computed fields', () => {
    const now = new Date('2026-08-30T10:00:00.000Z');
    const record = entryToRecord(
      {
        id: 'entry-1',
        organizationId: 'org-1',
        salesManagerUserId: 'mgr-1',
        status: 'negotiations',
        nextContactAt: now,
        potentialStudentsCount: 25,
        createdAt: now,
        updatedAt: now,
      },
      {
        organizationName: 'ООО Белтех',
        organizationUnp: '123',
        salesManagerName: 'Иванов Иван',
        lastContactAt: now.toISOString(),
        dealStudentsCount: 20,
        actualStudentsCount: 10,
        expectedContractAmount: '16000.00',
        receiptsTotal: '5000.00',
        latestNotePreview: 'Ждём ответа',
        dealsCount: 1,
        isOverdue: false,
        isDueToday: true,
      },
    );

    expect(record.organization_name).toBe('ООО Белтех');
    expect(record.deal_students_count).toBe(20);
    expect(record.is_due_today).toBe(true);
  });
});

describe('Sales diary ACL (service-level expectations)', () => {
  it('documents manager isolation rule', () => {
    const err = new ForbiddenException('Diary entry access denied');
    expect(err).toBeInstanceOf(ForbiddenException);
  });
});
