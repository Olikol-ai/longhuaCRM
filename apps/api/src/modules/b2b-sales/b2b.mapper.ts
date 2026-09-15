import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/b2b.dto';

export function organizationToRecord(row: {
  id: string;
  name: string;
  unp: string | null;
  salesManagerUserId: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    unp: row.unp ?? '',
    sales_manager_user_id: row.salesManagerUserId,
    status: row.status,
    notes: row.notes ?? '',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function receiptToRecord(row: {
  id: string;
  organizationId: string;
  groupId: string | null;
  amount: string;
  currency: string;
  receivedAt: Date | null;
  status: string;
  purpose: string | null;
  salesManagerUserId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    organization_id: row.organizationId,
    group_id: row.groupId,
    amount: row.amount,
    currency: row.currency,
    received_at: row.receivedAt ? row.receivedAt.toISOString() : null,
    status: row.status,
    purpose: row.purpose ?? '',
    sales_manager_user_id: row.salesManagerUserId,
    created_by_user_id: row.createdByUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mergeOrganizationDto(
  dto: CreateOrganizationDto | UpdateOrganizationDto,
): Partial<{
  name: string;
  unp: string | null;
  salesManagerUserId: string | null;
  status: 'active' | 'archived';
  notes: string | null;
}> {
  const patch: Partial<{
    name: string;
    unp: string | null;
    salesManagerUserId: string | null;
    status: 'active' | 'archived';
    notes: string | null;
  }> = {};
  if (dto.name !== undefined) {
    patch.name = dto.name.trim();
  }
  if (dto.unp !== undefined) {
    const unp = dto.unp.trim();
    patch.unp = unp || null;
  }
  if (dto.salesManagerUserId !== undefined) {
    patch.salesManagerUserId = dto.salesManagerUserId?.trim() || null;
  }
  if (dto.status !== undefined) {
    patch.status = dto.status;
  }
  if (dto.notes !== undefined) {
    patch.notes = dto.notes.trim() || null;
  }
  return patch;
}
