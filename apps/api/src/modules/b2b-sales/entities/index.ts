export { OrganizationEntity } from './organization.entity';
export { OrganizationReceiptEntity } from './organization-receipt.entity';
export { SalesManagerProfileEntity } from './sales-manager-profile.entity';
export { SalesCommissionAccrualEntity } from './sales-commission-accrual.entity';
export { SalesCommissionPayoutEntity } from './sales-commission-payout.entity';
export { SalesDiaryEntryEntity, SALES_DIARY_STATUSES } from './sales-diary-entry.entity';
export { SalesDiaryNoteEntity } from './sales-diary-note.entity';
export {
  SalesDiaryContactEntity,
  SALES_DIARY_CONTACT_TYPES,
} from './sales-diary-contact.entity';
export { OrganizationDealEntity } from './organization-deal.entity';

import { OrganizationEntity } from './organization.entity';
import { OrganizationReceiptEntity } from './organization-receipt.entity';
import { SalesManagerProfileEntity } from './sales-manager-profile.entity';
import { SalesCommissionAccrualEntity } from './sales-commission-accrual.entity';
import { SalesCommissionPayoutEntity } from './sales-commission-payout.entity';
import { SalesDiaryEntryEntity } from './sales-diary-entry.entity';
import { SalesDiaryNoteEntity } from './sales-diary-note.entity';
import { SalesDiaryContactEntity } from './sales-diary-contact.entity';
import { OrganizationDealEntity } from './organization-deal.entity';

export const B2B_SALES_ENTITIES = [
  OrganizationEntity,
  OrganizationReceiptEntity,
  SalesManagerProfileEntity,
  SalesCommissionAccrualEntity,
  SalesCommissionPayoutEntity,
  SalesDiaryEntryEntity,
  SalesDiaryNoteEntity,
  SalesDiaryContactEntity,
  OrganizationDealEntity,
];
