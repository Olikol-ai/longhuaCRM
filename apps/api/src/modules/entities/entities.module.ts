import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AlfaBankOrderEntity,
  AppSettingEntity,
  CourseEntity,
  LessonBalanceEntity,
  LessonEntity,
  LessonMaterialEntity,
  LessonStudentEntity,
  MaterialAccessEntity,
  PaymentEntity,
  ScheduleSlotEntity,
  ShopSettingEntity,
  StudentEntity,
  TeacherAvailabilityEntity,
  TeacherEntity,
  TeacherPaymentEntity,
  WelcomePageSettingEntity,
} from '../../entities/crm.entities';
import { UsersModule } from '../users/users.module';
import { EntitiesController } from './entities.controller';
import { EntityRepositoryService } from './entity-repository.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      StudentEntity,
      TeacherEntity,
      LessonEntity,
      PaymentEntity,
      CourseEntity,
      LessonMaterialEntity,
      ScheduleSlotEntity,
      LessonStudentEntity,
      LessonBalanceEntity,
      TeacherPaymentEntity,
      MaterialAccessEntity,
      TeacherAvailabilityEntity,
      AlfaBankOrderEntity,
      AppSettingEntity,
      ShopSettingEntity,
      WelcomePageSettingEntity,
    ]),
  ],
  controllers: [EntitiesController],
  providers: [EntityRepositoryService],
  exports: [EntityRepositoryService],
})
export class EntitiesModule {}
