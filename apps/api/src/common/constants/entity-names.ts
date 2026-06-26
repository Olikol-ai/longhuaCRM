export const ENTITY_NAMES = [
  'Student',
  'Teacher',
  'Lesson',
  'Payment',
  'Course',
  'LessonMaterial',
  'ScheduleSlot',
  'LessonStudent',
  'LessonBalance',
  'TeacherPayment',
  'MaterialAccess',
  'TeacherAvailability',
  'AlfaBankOrder',
  'AppSettings',
  'ShopSettings',
  'WelcomePageSettings',
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number] | 'User';

export const PUBLIC_READ_ENTITIES = ['WelcomePageSettings'] as const;

export const ENTITY_TABLE_MAP: Record<EntityName, string> = {
  User: 'users',
  Student: 'students',
  Teacher: 'teachers',
  Lesson: 'lessons',
  Payment: 'payments',
  Course: 'courses',
  LessonMaterial: 'lesson_materials',
  ScheduleSlot: 'schedule_slots',
  LessonStudent: 'lesson_students',
  LessonBalance: 'lesson_balances',
  TeacherPayment: 'teacher_payments',
  MaterialAccess: 'material_access',
  TeacherAvailability: 'teacher_availabilities',
  AlfaBankOrder: 'alfa_bank_orders',
  AppSettings: 'app_settings',
  ShopSettings: 'shop_settings',
  WelcomePageSettings: 'welcome_page_settings',
};
