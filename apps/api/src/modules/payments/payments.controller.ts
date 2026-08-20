import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAllPayments(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.findAllPayments(user);
  }

  @Post('filter')
  filterPayments(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.paymentsService.filterPayments(user, dto.where ?? {});
  }

  @Get('shop-items')
  findAllShopItems() {
    return this.paymentsService.findAllShopItems();
  }

  @Post('shop-items/filter')
  filterShopItems(@Body() dto: FilterQueryDto) {
    return this.paymentsService.filterShopItems(dto.where ?? {});
  }

  @Get('shop-items/:id')
  findShopItemById(@Param('id') id: string) {
    return this.paymentsService.findShopItemById(id);
  }

  @Post('shop-items')
  @Roles('admin')
  createShopItem(@Body() dto: CreateShopItemDto) {
    return this.paymentsService.createShopItem(dto);
  }

  @Patch('shop-items/:id')
  @Roles('admin')
  updateShopItem(@Param('id') id: string, @Body() dto: UpdateShopItemDto) {
    return this.paymentsService.updateShopItem(id, dto);
  }

  @Delete('shop-items/:id')
  @Roles('admin')
  deleteShopItem(@Param('id') id: string) {
    return this.paymentsService.deleteShopItem(id);
  }

  @Get(':id')
  findPaymentById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.findPaymentById(user, id);
  }

  @Post()
  @Roles('admin', 'teacher')
  createPayment(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'teacher')
  updatePayment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentsService.updatePayment(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  deletePayment(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.deletePayment(user, id);
  }
}
