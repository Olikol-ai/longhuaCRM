import { SalesDiaryContactEntity } from './entities/sales-diary-contact.entity';
import { SalesDiaryEntryEntity } from './entities/sales-diary-entry.entity';
import { SalesDiaryNoteEntity } from './entities/sales-diary-note.entity';
import { OrganizationDealEntity } from './entities/organization-deal.entity';

export function noteToRecord(row: SalesDiaryNoteEntity): Record<string, unknown> {
  return {
    id: row.id,
    entry_id: row.entryId,
    sales_manager_user_id: row.salesManagerUserId,
    note: row.note,
    created_at: row.createdAt.toISOString(),
  };
}

export function contactToRecord(row: SalesDiaryContactEntity): Record<string, unknown> {
  return {
    id: row.id,
    entry_id: row.entryId,
    sales_manager_user_id: row.salesManagerUserId,
    contact_type: row.contactType,
    contacted_at: row.contactedAt.toISOString(),
    result: row.result ?? '',
    next_contact_at: row.nextContactAt ? row.nextContactAt.toISOString() : null,
    comment: row.comment ?? '',
    created_at: row.createdAt.toISOString(),
  };
}

export function dealToRecord(row: OrganizationDealEntity): Record<string, unknown> {
  return {
    id: row.id,
    organization_id: row.organizationId,
    entry_id: row.entryId,
    sales_manager_user_id: row.salesManagerUserId,
    group_id: row.groupId,
    students_count: row.studentsCount,
    price_per_student: row.pricePerStudent,
    amount: row.amount,
    currency: row.currency,
    contract_date: row.contractDate,
    start_date: row.startDate,
    status: row.status,
    comment: row.comment ?? '',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function entryToRecord(
  row: SalesDiaryEntryEntity,
  extras: {
    organizationName: string;
    organizationUnp: string;
    salesManagerName: string;
    lastContactAt: string | null;
    dealStudentsCount: number;
    actualStudentsCount: number;
    expectedContractAmount: string;
    receiptsTotal: string;
    latestNotePreview: string;
    dealsCount: number;
    isOverdue: boolean;
    isDueToday: boolean;
  },
): Record<string, unknown> {
  return {
    id: row.id,
    organization_id: row.organizationId,
    organization_name: extras.organizationName,
    organization_unp: extras.organizationUnp,
    sales_manager_user_id: row.salesManagerUserId,
    sales_manager_name: extras.salesManagerName,
    status: row.status,
    next_contact_at: row.nextContactAt ? row.nextContactAt.toISOString() : null,
    potential_students_count: row.potentialStudentsCount,
    deal_students_count: extras.dealStudentsCount,
    actual_students_count: extras.actualStudentsCount,
    expected_contract_amount: extras.expectedContractAmount,
    receipts_total: extras.receiptsTotal,
    latest_note_preview: extras.latestNotePreview,
    deals_count: extras.dealsCount,
    last_contact_at: extras.lastContactAt,
    is_overdue: extras.isOverdue,
    is_due_today: extras.isDueToday,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
