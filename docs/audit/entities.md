# Аудит: Entity

**Ссылка:** [refactor-plan.md §4](../refactor-plan.md#4-аудит-entity-по-каждой-сущности)

## Сводка

| Метрика | Значение |
|---------|----------|
| Всего Entity-классов | 19 (+ 1 удалённый JsonRecordEntity) |
| В ALL_ENTITIES | 17 |
| TypeORM relations | 0 |
| Конфликты table name | 2 пары |

## Реестр Entity

| Entity | Файл | Таблица | ALL_ENTITIES | Relations |
|--------|------|---------|--------------|-----------|
| UserEntity | `user.entity.ts` | users | да | — |
| StudentEntity | `Student.entity.ts` | students | да | — |
| TeacherEntity | `Teacher.entity.ts` | teachers | да | — |
| LessonEntity | `Lesson.entity.ts` | lessons | да | — |
| PaymentEntity | `Payment.entity.ts` | payments | да | — |
| CourseEntity | `Course.entity.ts` | courses | да | — |
| LessonMaterialEntity | `LessonMaterial.entity.ts` | lesson_materials | да | — |
| ScheduleSlotEntity | `ScheduleSlot.entity.ts` | schedule_slots | да | — |
| LessonStudentEntity | `LessonStudent.entity.ts` | lesson_students | да | — |
| LessonBalanceEntity | `LessonBalance.entity.ts` | lesson_balances | да | — |
| TeacherPaymentEntity | `TeacherPayment.entity.ts` | teacher_payments | да | — |
| MaterialAccessEntity | `MaterialAccess.entity.ts` | material_access | да | — |
| TeacherAvailabilityEntity | `TeacherAvailability.entity.ts` | teacher_availability ⚠️ | да | — |
| AlfaBankOrderEntity | `alfaBankOrder.entity.ts` | alfa_bank_orders | да | — |
| AppSettingEntity | `AppSetting.entity.ts` | app_settings | да | — |
| ShopSettingEntity | `ShopSetting.entity.ts` | shop_settings | да | — |
| WelcomePageSettingEntity | `WelcomePageSetting.entity.ts` | welcome_page_settings | да | — |
| ShopEntity | `Shop.entity.ts` | shop_settings ⚠️ | **нет** | — |
| WelcomePageEntity | `WelcomePage.entity.ts` | welcome_page_settings ⚠️ | **нет** | — |

## Критические проблемы

1. **Нет relations** — все FK как `@Column uuid`
2. **PaymentEntity ≠ frontend** — нет `lessons_added`, `payment_date`, `comment`, `student_name`
3. **ShopSettingEntity ≠ frontend** — key/value vs `item_id`, `label`, `lessons`
4. **WelcomePageSettingEntity ≠ frontend** — key/value vs `school_name`, `body_text`
5. **Дублирование баланса** — `Student.lessonBalance` + `LessonBalanceEntity`
6. **Дублирование групповых уроков** — `Lesson.studentIds` + `LessonStudentEntity`
7. **jsonb slots** — `TeacherAvailabilityEntity.slots:26`

## Целевые relations

См. [refactor-roadmap.md](../refactor-roadmap.md#карта-зависимостей-entity).

## Действия по этапам

| Entity | Этап 1 | Этап 2b | Этап 2c | Этап 8 |
|--------|--------|---------|---------|--------|
| Payment | columns | redesign | FK | — |
| Shop* | — | shop_items | FK | remove duplicate |
| Welcome* | — | welcome_pages | — | remove duplicate |
| TeacherAvailability | rename table | — | FK | slots entity |
| Student/LessonBalance | columns | — | FK | unify balance |
