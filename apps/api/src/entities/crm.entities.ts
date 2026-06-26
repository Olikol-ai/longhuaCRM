import { Entity } from 'typeorm';
import { JsonRecordEntity } from './json-record.entity';

@Entity('students')
export class StudentEntity extends JsonRecordEntity {}

@Entity('teachers')
export class TeacherEntity extends JsonRecordEntity {}

@Entity('lessons')
export class LessonEntity extends JsonRecordEntity {}

@Entity('payments')
export class PaymentEntity extends JsonRecordEntity {}

@Entity('courses')
export class CourseEntity extends JsonRecordEntity {}

@Entity('lesson_materials')
export class LessonMaterialEntity extends JsonRecordEntity {}

@Entity('schedule_slots')
export class ScheduleSlotEntity extends JsonRecordEntity {}

@Entity('lesson_students')
export class LessonStudentEntity extends JsonRecordEntity {}

@Entity('lesson_balances')
export class LessonBalanceEntity extends JsonRecordEntity {}

@Entity('teacher_payments')
export class TeacherPaymentEntity extends JsonRecordEntity {}

@Entity('material_access')
export class MaterialAccessEntity extends JsonRecordEntity {}

@Entity('teacher_availabilities')
export class TeacherAvailabilityEntity extends JsonRecordEntity {}

@Entity('alfa_bank_orders')
export class AlfaBankOrderEntity extends JsonRecordEntity {}

@Entity('app_settings')
export class AppSettingEntity extends JsonRecordEntity {}

@Entity('shop_settings')
export class ShopSettingEntity extends JsonRecordEntity {}

@Entity('welcome_page_settings')
export class WelcomePageSettingEntity extends JsonRecordEntity {}
