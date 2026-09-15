import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { UserEntity } from '../users/entities/user.entity';
import { B2B_SALES_ENTITIES } from './entities';
import { B2bAccessService } from './b2b-access.service';
import { B2bDashboardService } from './b2b-dashboard.service';
import { B2bSalesController } from './b2b-sales.controller';
import { OrganizationReceiptsService } from './organization-receipts.service';
import { OrganizationsService } from './organizations.service';
import { SalesCommissionsService } from './sales-commissions.service';
import { SalesDiaryService } from './sales-diary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...B2B_SALES_ENTITIES,
      GroupEntity,
      GroupMemberEntity,
      UserEntity,
    ]),
  ],
  controllers: [B2bSalesController],
  providers: [
    B2bAccessService,
    OrganizationsService,
    OrganizationReceiptsService,
    SalesCommissionsService,
    B2bDashboardService,
    SalesDiaryService,
  ],
  exports: [
    B2bAccessService,
    OrganizationsService,
    OrganizationReceiptsService,
    SalesCommissionsService,
    B2bDashboardService,
    SalesDiaryService,
  ],
})
export class B2bSalesModule {}
