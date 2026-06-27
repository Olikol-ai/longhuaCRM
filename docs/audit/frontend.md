# Аудит: Frontend

## API client

**Файл:** `src/api/base44Client.js`

- Все entity через `/api/entities/${entityName}`
- Snake_case в body (не трансформируется)
- Token: `localStorage` key `longhua_access_token`
- Functions: `/api/functions/${name}`

## Entity clients (17 + User)

`Student`, `Teacher`, `Lesson`, `Payment`, `Course`, `LessonMaterial`, `ScheduleSlot`, `LessonStudent`, `LessonBalance`, `TeacherPayment`, `MaterialAccess`, `TeacherAvailability`, `AlfaBankOrder`, `AppSettings`, `ShopSettings`, `WelcomePageSettings`, `User`

## Страницы по Entity (grep base44.entities)

| Entity | Файлы |
|--------|-------|
| Student | Payments, Schedule, UserManagement, StudentDashboard, StudentLessons, StudentDetail, Analytics, ExportData, … |
| Teacher | Schedule, TeacherSchedule, UserManagement, Salary, Analytics, … |
| Lesson | Schedule, TeacherSchedule, TeacherDashboard, StudentLessons, Analytics, ExportData, … |
| Payment | Payments, Analytics, ExportData, StudentDetailModal |
| Course | MaterialsHub, WindowsFileBrowser, BulkAccessModal, UserManagement |
| LessonMaterial | MaterialsHub, WindowsFileBrowser, MaterialFormDialog, … |
| MaterialAccess | materialAccess.js, BulkAccessModal, AccessManageModal, GrantAccessModal |
| AppSettings | TelegramSettings, AdminSettings |
| ShopSettings | ShopSettingsAdmin |
| WelcomePageSettings | WelcomePageEditor, Welcome |
| TeacherAvailability | TeacherAvailabilityTab, TeacherAvailabilityView |
| User | UserManagement, AuthContext |

## Критические разрывы контракта

### Payment

Frontend поля: `student_name`, `lessons_added`, `payment_date`, `comment`  
Файлы: `Payments.jsx`, `PaymentFormDialog.jsx`, `PaymentModal.jsx`

### ShopSettings

Frontend поля: `item_id`, `label`, `lessons`, `price`, `note`, `sort_order`, `is_active`, `type`, `description`  
Файл: `ShopSettingsAdmin.jsx:5-18`

### WelcomePageSettings

Frontend поля: `school_name`, `title`, `subtitle`, `body_text`, `info_text`  
Файл: `WelcomePageEditor.jsx:7-12`

### MaterialAccess (часть UI)

`BulkAccessModal.jsx` использует `student_ids`, `access_type`, `granted_by` — не совпадает с Entity (`user_id`, `granted_by_role`, `access`).

## Стратегия миграции frontend

| Фаза | Действие | Этап roadmap |
|------|----------|--------------|
| A | Без изменений — mapper чинит API | 2a–2b |
| B | Parallel: новые typed clients рядом с base44 | 4 |
| C | Страница за страницей на v2 API | 5 |
| D | Удалить base44Client entity factory | 8 |

## Файлы для изменения (этап 5)

Приоритет P0: `base44Client.js`, `Payments.jsx`, `ShopSettingsAdmin.jsx`, `WelcomePageEditor.jsx`, `Schedule.jsx`  
Приоритет P1: `materialAccess.js`, `BulkAccessModal.jsx`, `UserManagement.jsx`  
Приоритет P2: остальные 30+ файлов с `base44.entities`
