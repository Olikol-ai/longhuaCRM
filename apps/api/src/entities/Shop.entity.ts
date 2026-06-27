import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type ShopItemType = 'course' | 'package';
  
  @Entity('shop_settings')
  export class ShopEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text' })
    name: string;
  
    @Column({
      type: 'enum',
      enum: ['course', 'package'],
    })
    type: ShopItemType;
  
    @Column({ type: 'text', nullable: true })
    description: string;
  
    @Column({ type: 'numeric', precision: 10, scale: 2 })
    price: number;
  
    @Column({ type: 'int', default: 1 })
    lessonsCount: number;
  
    @Column({ type: 'boolean', default: true })
    isActive: boolean;
  
    @Column({ type: 'text', nullable: true })
    imageUrl: string;
  
    @Column({ type: 'text', nullable: true })
    currency: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }