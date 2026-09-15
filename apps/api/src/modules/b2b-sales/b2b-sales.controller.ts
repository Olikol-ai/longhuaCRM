import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { B2bDashboardService } from './b2b-dashboard.service';
import {
  B2bDashboardFilterDto,
  CreateCommissionPayoutDto,
  CreateOrganizationDto,
  CreateOrganizationReceiptDto,
  UpdateOrganizationDto,
  UpdateSalesManagerProfileDto,
} from './dto/b2b.dto';
import { OrganizationReceiptsService } from './organization-receipts.service';
import { OrganizationsService } from './organizations.service';
import { SalesCommissionsService } from './sales-commissions.service';
import { SalesDiaryService } from './sales-diary.service';
import {
  BulkCreateSalesDiaryEntriesDto,
  CreateOrganizationDealDto,
  CreateSalesDiaryContactDto,
  CreateSalesDiaryEntryDto,
  CreateSalesDiaryNoteDto,
  ReassignSalesDiaryEntryDto,
  SalesDiaryListFilterDto,
  UpdateOrganizationDealDto,
  UpdateSalesDiaryEntryDto,
} from './dto/sales-diary.dto';

@Controller('b2b')
@UseGuards(JwtAuthGuard, RolesGuard)
export class B2bSalesController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly receipts: OrganizationReceiptsService,
    private readonly commissions: SalesCommissionsService,
    private readonly dashboard: B2bDashboardService,
    private readonly diary: SalesDiaryService,
  ) {}

  @Get('dashboard')
  @Roles('admin', 'sales_manager')
  dashboardView(@CurrentUser() actor: JwtPayload, @Query() filters: B2bDashboardFilterDto) {
    return this.dashboard.getDashboard(actor, filters);
  }

  @Get('organizations')
  @Roles('admin', 'sales_manager')
  listOrganizations(@CurrentUser() actor: JwtPayload) {
    return this.organizations.list(actor);
  }

  @Get('organizations/:id')
  @Roles('admin', 'sales_manager')
  getOrganization(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.organizations.findById(actor, id);
  }

  @Post('organizations')
  @Roles('admin')
  createOrganization(@CurrentUser() actor: JwtPayload, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(actor, dto);
  }

  @Patch('organizations/:id')
  @Roles('admin')
  updateOrganization(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(actor, id, dto);
  }

  @Delete('organizations/:id')
  @Roles('admin')
  removeOrganization(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.organizations.remove(actor, id);
  }

  @Get('receipts')
  @Roles('admin', 'sales_manager')
  listReceipts(
    @CurrentUser() actor: JwtPayload,
    @Query() filters: B2bDashboardFilterDto,
  ) {
    return this.receipts.list(actor, {
      organizationId: filters.organizationId,
      groupId: filters.groupId,
      status: filters.receiptStatus,
      from: filters.from,
      to: filters.to,
    });
  }

  @Post('receipts')
  @Roles('admin')
  createReceipt(@CurrentUser() actor: JwtPayload, @Body() dto: CreateOrganizationReceiptDto) {
    return this.receipts.create(actor, dto);
  }

  @Get('commissions/accruals')
  @Roles('admin', 'sales_manager')
  listAccruals(
    @CurrentUser() actor: JwtPayload,
    @Query('managerUserId') managerUserId?: string,
  ) {
    return this.commissions.listAccruals(actor, managerUserId);
  }

  @Get('commissions/summary/:managerUserId')
  @Roles('admin', 'sales_manager')
  commissionSummary(
    @CurrentUser() actor: JwtPayload,
    @Param('managerUserId') managerUserId: string,
  ) {
    return this.commissions.managerSummary(actor, managerUserId);
  }

  @Post('commissions/payouts')
  @Roles('admin')
  createPayout(@CurrentUser() actor: JwtPayload, @Body() dto: CreateCommissionPayoutDto) {
    return this.commissions.createPayout(actor, dto);
  }

  @Get('managers/:userId/profile')
  @Roles('admin', 'sales_manager')
  managerProfile(@CurrentUser() actor: JwtPayload, @Param('userId') userId: string) {
    return this.commissions.getProfile(actor, userId);
  }

  @Patch('managers/:userId/profile')
  @Roles('admin')
  updateManagerProfile(
    @CurrentUser() actor: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateSalesManagerProfileDto,
  ) {
    return this.commissions.updateProfile(actor, userId, dto);
  }

  @Get('groups/:groupId/counterparty')
  @Roles('admin', 'sales_manager', 'teacher')
  groupCounterparty(@Param('groupId') groupId: string) {
    return this.dashboard.getGroupCounterpartySummary(groupId);
  }

  @Get('diary/summary')
  @Roles('admin', 'sales_manager')
  diarySummary(
    @CurrentUser() actor: JwtPayload,
    @Query('managerUserId') managerUserId?: string,
  ) {
    return this.diary.getSummary(actor, managerUserId);
  }

  @Get('diary/entries')
  @Roles('admin', 'sales_manager')
  listDiaryEntries(@CurrentUser() actor: JwtPayload, @Query() filters: SalesDiaryListFilterDto) {
    return this.diary.listEntries(actor, filters);
  }

  @Get('diary/entries/:id')
  @Roles('admin', 'sales_manager')
  getDiaryEntry(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.diary.getEntry(actor, id);
  }

  @Post('diary/entries')
  @Roles('admin')
  createDiaryEntry(@CurrentUser() actor: JwtPayload, @Body() dto: CreateSalesDiaryEntryDto) {
    return this.diary.createEntry(actor, dto);
  }

  @Post('diary/entries/bulk')
  @Roles('admin')
  bulkCreateDiaryEntries(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: BulkCreateSalesDiaryEntriesDto,
  ) {
    return this.diary.bulkCreateEntries(actor, dto);
  }

  @Patch('diary/entries/:id')
  @Roles('admin', 'sales_manager')
  updateDiaryEntry(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSalesDiaryEntryDto,
  ) {
    return this.diary.updateEntry(actor, id, dto);
  }

  @Patch('diary/entries/:id/reassign')
  @Roles('admin')
  reassignDiaryEntry(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReassignSalesDiaryEntryDto,
  ) {
    return this.diary.reassignEntry(actor, id, dto);
  }

  @Delete('diary/entries/:id')
  @Roles('admin')
  removeDiaryEntry(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.diary.removeEntry(actor, id);
  }

  @Get('diary/entries/:id/notes')
  @Roles('admin', 'sales_manager')
  listDiaryNotes(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.diary.listNotes(actor, id);
  }

  @Post('diary/entries/:id/notes')
  @Roles('admin', 'sales_manager')
  addDiaryNote(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateSalesDiaryNoteDto,
  ) {
    return this.diary.addNote(actor, id, dto);
  }

  @Get('diary/entries/:id/contacts')
  @Roles('admin', 'sales_manager')
  listDiaryContacts(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.diary.listContacts(actor, id);
  }

  @Post('diary/entries/:id/contacts')
  @Roles('admin', 'sales_manager')
  addDiaryContact(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateSalesDiaryContactDto,
  ) {
    return this.diary.addContact(actor, id, dto);
  }

  @Post('diary/entries/:id/deals')
  @Roles('admin', 'sales_manager')
  createDiaryDeal(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateOrganizationDealDto,
  ) {
    return this.diary.createDeal(actor, id, dto);
  }

  @Patch('diary/deals/:id')
  @Roles('admin', 'sales_manager')
  updateDiaryDeal(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDealDto,
  ) {
    return this.diary.updateDeal(actor, id, dto);
  }
}
