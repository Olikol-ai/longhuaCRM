import { ShopItemEntity } from '../../entities/shop-item.entity';

export function shopItemToRecord(row: ShopItemEntity): Record<string, unknown> {
  return {
    id: row.id,
    item_id: row.itemId,
    label: row.label,
    lessons: row.lessons ?? 0,
    price: row.price != null ? Number(row.price) : 0,
    note: row.note ?? '',
    description: row.description ?? '',
    type: row.type,
    sort_order: row.sortOrder ?? 0,
    is_active: row.isActive ?? true,
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
  };
}

export function recordToShopItemPayload(
  input: Record<string, unknown>,
): Partial<ShopItemEntity> {
  const payload: Partial<ShopItemEntity> = {};

  if (input.item_id !== undefined) payload.itemId = String(input.item_id);
  if (input.label !== undefined) payload.label = String(input.label);
  if (input.lessons !== undefined) payload.lessons = Number(input.lessons);
  if (input.price !== undefined) payload.price = Number(input.price);
  if (input.note !== undefined) payload.note = String(input.note);
  if (input.description !== undefined) payload.description = String(input.description);
  if (input.type !== undefined) payload.type = String(input.type) as ShopItemEntity['type'];
  if (input.sort_order !== undefined) payload.sortOrder = Number(input.sort_order);
  if (input.is_active !== undefined) payload.isActive = Boolean(input.is_active);

  return payload;
}
