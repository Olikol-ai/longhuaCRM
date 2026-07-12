import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { ShopItemEntity } from './entities/shop-item.entity';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(ShopItemEntity)
    private readonly shopItemRepo: Repository<ShopItemEntity>,
  ) {}

  findAllPayments(): Promise<PaymentEntity[]> {
    return this.paymentRepo.find();
  }

  findPaymentById(id: string): Promise<PaymentEntity | null> {
    return this.paymentRepo.findOne({ where: { id } });
  }

  savePayment(entity: Partial<PaymentEntity>): Promise<PaymentEntity> {
    return this.paymentRepo.save(this.paymentRepo.create(entity));
  }

  async updatePayment(id: string, data: Partial<PaymentEntity>): Promise<PaymentEntity | null> {
    await this.paymentRepo.update({ id }, data);
    return this.findPaymentById(id);
  }

  async deletePayment(id: string): Promise<void> {
    await this.paymentRepo.delete({ id });
  }

  filterPayments(where: FindOptionsWhere<PaymentEntity>): Promise<PaymentEntity[]> {
    return this.paymentRepo.find({ where });
  }

  findAllShopItems(): Promise<ShopItemEntity[]> {
    return this.shopItemRepo.find({ order: { sortOrder: 'ASC' } });
  }

  findShopItemById(id: string): Promise<ShopItemEntity | null> {
    return this.shopItemRepo.findOne({ where: { id } });
  }

  saveShopItem(entity: Partial<ShopItemEntity>): Promise<ShopItemEntity> {
    return this.shopItemRepo.save(this.shopItemRepo.create(entity));
  }

  async updateShopItem(id: string, data: Partial<ShopItemEntity>): Promise<ShopItemEntity | null> {
    await this.shopItemRepo.update({ id }, data);
    return this.findShopItemById(id);
  }

  async deleteShopItem(id: string): Promise<void> {
    await this.shopItemRepo.delete({ id });
  }

  filterShopItems(where: FindOptionsWhere<ShopItemEntity>): Promise<ShopItemEntity[]> {
    return this.shopItemRepo.find({ where });
  }
}
