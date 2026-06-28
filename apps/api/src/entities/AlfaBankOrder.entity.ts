import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
  export type OrderType = 'package' | 'course';
  
/** @deprecated Legacy table — runtime uses payments table. Not exposed via entity API. */
  @Entity('alfa_bank_orders')
  export class AlfaBankOrderEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_ALFA_ORDER_STUDENT_ID')
    @Column({ name: 'student_id', type: 'uuid' })
    studentId: string;
  
    @Index('IDX_ALFA_ORDER_ORDER_NUMBER', { unique: true })
    @Column({ name: 'order_number' })
    orderNumber: string;
  
    @Index('IDX_ALFA_ORDER_ALFA_ORDER_ID', { unique: true })
    @Column({ name: 'alfa_order_id', nullable: true })
    alfaOrderId: string;
  
    @Column({ type: 'enum', enum: ['package', 'course'] })
    type: OrderType;
  
    @Column({ name: 'item_id', type: 'uuid' })
    itemId: string;
  
    @Column({ type: 'numeric', precision: 10, scale: 2 })
    amount: number;
  
    @Column({
      type: 'enum',
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
    })
    status: PaymentStatus;
  
    @Column({ name: 'payment_date', type: 'timestamptz', nullable: true })
    paymentDate: Date;
  
    @Column({ type: 'text', nullable: true })
    notes: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }